import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken } from "../src/accessToken";
import type { Deps } from "../src/deps";
import type { Env } from "../src/env";
import { handleDeleteAccount } from "../src/routes/account";
import { createDevice, findOrCreateUser, listDevices } from "../src/sessions";

const ORIGIN = "https://paka-paka.app";

async function signedInDevice(sub = "g-1", label = "Phone", userIdOverride?: string) {
  const now = Date.now();
  const userId = userIdOverride ?? (await findOrCreateUser(env.DB, "google", sub, now));
  const { deviceId, refreshToken } = await createDevice(env, userId, label, now);
  const accessToken = await issueAccessToken(env, userId, deviceId, now);
  return { userId, deviceId, refreshToken, accessToken };
}

function call(method: string, path: string, accessToken?: string) {
  return SELF.fetch(`${ORIGIN}${path}`, {
    method,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

const activeDeviceIds = async (userId: string) => (await listDevices(env.DB, userId, Date.now())).map((d) => d.deviceId);

beforeEach(async () => {
  await env.DB.batch(
    ["refresh_tokens", "sync_state", "identities", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
  const { objects } = await env.PROGRESS.list();
  if (objects.length) await env.PROGRESS.delete(objects.map((o) => o.key));
});

describe("GET /api/account", () => {
  it("account lists devices and marks current", async () => {
    const a = await signedInDevice("g-1", "Phone");
    const b = await signedInDevice("g-1", "Laptop");
    const res = await call("GET", "/api/account", a.accessToken);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      provider: string;
      devices: Array<{ deviceId: string; label: string; lastUsedAt: number; current: boolean }>;
    };
    expect(body.provider).toBe("google");
    expect(body.devices).toHaveLength(2);
    expect(body.devices.find((d) => d.deviceId === a.deviceId)).toMatchObject({ label: "Phone", current: true });
    expect(body.devices.find((d) => d.deviceId === b.deviceId)).toMatchObject({ label: "Laptop", current: false });
    expect(typeof body.devices[0].lastUsedAt).toBe("number");
  });
});

describe("DELETE /api/account/devices/:deviceId", () => {
  it("removing another device revokes only it", async () => {
    const a = await signedInDevice("g-1", "Phone");
    const b = await signedInDevice("g-1", "Laptop");
    const res = await call("DELETE", `/api/account/devices/${b.deviceId}`, a.accessToken);
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await activeDeviceIds(a.userId)).toEqual([a.deviceId]);
  });

  it("removing a device of another user → 404", async () => {
    const a = await signedInDevice("g-1");
    const other = await signedInDevice("g-2");
    const res = await call("DELETE", `/api/account/devices/${other.deviceId}`, a.accessToken);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(await activeDeviceIds(other.userId)).toEqual([other.deviceId]);
  });

  it("a path with extra segments → 404", async () => {
    const a = await signedInDevice();
    const res = await call("DELETE", `/api/account/devices/${a.deviceId}/x`, a.accessToken);
    expect(res.status).toBe(404);
    expect(await activeDeviceIds(a.userId)).toEqual([a.deviceId]);
  });

  it("cookie path needs a matching Origin", async () => {
    const a = await signedInDevice();
    const res = await SELF.fetch(`${ORIGIN}/api/account/devices/${a.deviceId}`, {
      method: "DELETE",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(await activeDeviceIds(a.userId)).toEqual([a.deviceId]);
  });

  it("removing the current device over cookies clears the cookies", async () => {
    const a = await signedInDevice();
    const res = await SELF.fetch(`${ORIGIN}/api/account/devices/${a.deviceId}`, {
      method: "DELETE",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toHaveLength(3);
    expect(await activeDeviceIds(a.userId)).toEqual([]);
  });
});

describe("POST /api/account/signout-all", () => {
  it("signout-all revokes every device of this user only", async () => {
    const a = await signedInDevice("g-1", "Phone");
    const b = await signedInDevice("g-1", "Laptop");
    const other = await signedInDevice("g-2");
    const res = await call("POST", "/api/account/signout-all", a.accessToken);
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await activeDeviceIds(a.userId)).toEqual([]);
    expect(b.userId).toBe(a.userId);
    expect(await activeDeviceIds(other.userId)).toEqual([other.deviceId]);
  });

  it("cookie path needs a matching Origin", async () => {
    const a = await signedInDevice();
    const res = await SELF.fetch(`${ORIGIN}/api/account/signout-all`, {
      method: "POST",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad_origin" });
    expect(await activeDeviceIds(a.userId)).toEqual([a.deviceId]);
  });

  it("cookie path clears the cookies", async () => {
    const a = await signedInDevice();
    const res = await SELF.fetch(`${ORIGIN}/api/account/signout-all`, {
      method: "POST",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toHaveLength(3);
  });
});

describe("DELETE /api/account", () => {
  const countRows = async (userId: string) =>
    (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE user_id = ?").bind(userId).first<{ n: number }>())!.n;

  it("deletes every page of R2 objects", async () => {
    const a = await signedInDevice("g-1");
    const other = await signedInDevice("g-2");
    for (let start = 0; start < 1005; start += 100) {
      await Promise.all(
        Array.from({ length: Math.min(100, 1005 - start) }, (_, i) =>
          env.PROGRESS.put(`progress/${a.userId}/obj-${start + i}`, "x"),
        ),
      );
    }
    await env.PROGRESS.put(`progress/${other.userId}/keep`, "y");
    expect((await env.PROGRESS.list({ prefix: `progress/${a.userId}/` })).truncated).toBe(true);

    const res = await call("DELETE", "/api/account", a.accessToken);
    expect(res.status).toBe(204);
    expect((await env.PROGRESS.list({ prefix: `progress/${a.userId}/` })).objects).toHaveLength(0);
    expect((await env.PROGRESS.list({ prefix: `progress/${other.userId}/` })).objects).toHaveLength(1);
    expect(await countRows(a.userId)).toBe(0);
    expect(await countRows(other.userId)).toBe(1);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("cookie path clears the cookies", async () => {
    const a = await signedInDevice();
    const res = await SELF.fetch(`${ORIGIN}/api/account`, {
      method: "DELETE",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toHaveLength(3);
  });

  it("cookie path needs a matching Origin", async () => {
    const a = await signedInDevice();
    await env.PROGRESS.put(`progress/${a.userId}/state`, "x");
    const res = await SELF.fetch(`${ORIGIN}/api/account`, {
      method: "DELETE",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad_origin" });
    expect(await countRows(a.userId)).toBe(1);
    expect((await env.PROGRESS.list({ prefix: `progress/${a.userId}/` })).objects).toHaveLength(1);
  });

  it("a repeat delete with the same token makes no R2 call", async () => {
    const a = await signedInDevice();
    await env.PROGRESS.put(`progress/${a.userId}/state`, "x");
    let lists = 0;
    const spyBucket = new Proxy(env.PROGRESS, {
      get(target, prop) {
        if (prop === "list") {
          return (...args: Parameters<R2Bucket["list"]>) => {
            lists++;
            return target.list(...args);
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const spyEnv = { ...env, PROGRESS: spyBucket } as Env;
    const deps = { now: () => Date.now() } as Deps;
    const req = () => new Request(`${ORIGIN}/api/account`, { method: "DELETE", headers: { authorization: `Bearer ${a.accessToken}` } });

    expect((await handleDeleteAccount(req(), spyEnv, deps)).status).toBe(204);
    expect(lists).toBe(2);
    expect((await handleDeleteAccount(req(), spyEnv, deps)).status).toBe(204);
    expect(lists).toBe(2);
  });

  it("a repeat delete over cookies still clears the cookies", async () => {
    const a = await signedInDevice();
    const del = () =>
      SELF.fetch(`${ORIGIN}/api/account`, {
        method: "DELETE",
        headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: ORIGIN },
      });
    expect((await del()).status).toBe(204);
    const again = await del();
    expect(again.status).toBe(204);
    expect(again.headers.getSetCookie()).toHaveLength(3);
  });

  it("a sync file put after the first sweep is removed too", async () => {
    const a = await signedInDevice();
    await env.PROGRESS.put(`progress/${a.userId}/0000000001-old.json.gz`, "x");
    // A racing PUT puts its key after the first sweep and before deleteUserRows (which runs in db.batch).
    const racingDb = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "batch") {
          return async (...args: Parameters<D1Database["batch"]>) => {
            await env.PROGRESS.put(`progress/${a.userId}/0000000002-late.json.gz`, "y");
            return target.batch(...args);
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const racingEnv = { ...env, DB: racingDb } as Env;
    const deps = { now: () => Date.now() } as Deps;
    const req = new Request(`${ORIGIN}/api/account`, { method: "DELETE", headers: { authorization: `Bearer ${a.accessToken}` } });

    expect((await handleDeleteAccount(req, racingEnv, deps)).status).toBe(204);
    expect((await env.PROGRESS.list({ prefix: `progress/${a.userId}/` })).objects).toHaveLength(0);
    expect(await countRows(a.userId)).toBe(0);
  });

  it("D1 failure after R2 keeps the user for retry", async () => {
    const a = await signedInDevice();
    await env.PROGRESS.put(`progress/${a.userId}/state`, "x");
    let failNext = true;
    const flakyDb = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === "batch") {
          return (...args: Parameters<D1Database["batch"]>) => {
            if (failNext) {
              failNext = false;
              return Promise.reject(new Error("d1 down"));
            }
            return target.batch(...args);
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const flakyEnv = { ...env, DB: flakyDb } as Env;
    const deps = { now: () => Date.now() } as Deps;
    const req = () => new Request(`${ORIGIN}/api/account`, { method: "DELETE", headers: { authorization: `Bearer ${a.accessToken}` } });

    await expect(handleDeleteAccount(req(), flakyEnv, deps)).rejects.toThrow("d1 down");
    expect(await countRows(a.userId)).toBe(1);
    expect((await env.PROGRESS.list({ prefix: `progress/${a.userId}/` })).objects).toHaveLength(0);

    const retry = await handleDeleteAccount(req(), flakyEnv, deps);
    expect(retry.status).toBe(204);
    expect(await countRows(a.userId)).toBe(0);
  });
});

describe("unauthenticated", () => {
  it.each([
    ["GET", "/api/account"],
    ["DELETE", "/api/account/devices/abc"],
    ["POST", "/api/account/signout-all"],
    ["DELETE", "/api/account"],
  ])("%s %s → 401", async (method, path) => {
    const res = await call(method, path);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
