import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken } from "../src/accessToken";
import { createDevice, findOrCreateUser } from "../src/sessions";

const ORIGIN = "https://paka-paka.app";
let ipCounter = 0;

// A fresh IP per request keeps these tests clear of the auth rate limit.
function post(path: string, init: { headers?: Record<string, string>; body?: unknown } = {}) {
  return SELF.fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "cf-connecting-ip": `10.1.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`, ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function signedInDevice(sub = "g-1") {
  const now = Date.now();
  const userId = await findOrCreateUser(env.DB, "google", sub, now);
  const { deviceId, refreshToken } = await createDevice(env, userId, "Phone", now);
  const accessToken = await issueAccessToken(env, userId, deviceId, now);
  return { userId, deviceId, refreshToken, accessToken };
}

beforeEach(async () => {
  await env.DB.batch(
    ["refresh_tokens", "sync_state", "identities", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
});

describe("POST /api/auth/refresh", () => {
  it("(body) rotates; old token then 401", async () => {
    const d = await signedInDevice();
    const res = await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } });
    expect(res.status).toBe(200);
    const next = (await res.json()) as { accessToken: string; refreshToken: string };
    expect(next.refreshToken).not.toBe(d.refreshToken);
    expect(next.accessToken.split(".")).toHaveLength(3);
    expect(res.headers.getSetCookie()).toEqual([]);

    const replay = await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } });
    expect(replay.status).toBe(401);
    expect(await replay.json()).toEqual({ error: "unauthorized" });
    expect(replay.headers.getSetCookie()).toEqual([]);
    // Reuse revoked the device: the new token is dead too.
    expect((await post("/api/auth/refresh", { body: { refreshToken: next.refreshToken } })).status).toBe(401);
  });

  it("(body) needs no Origin", async () => {
    const d = await signedInDevice();
    expect((await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } })).status).toBe(200);
  });

  it("rejects a non-string body token with 400 bad_payload", async () => {
    const res = await post("/api/auth/refresh", { body: { refreshToken: 5 } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_payload" });
  });

  it("(cookie) sets three cookies with the exact attributes", async () => {
    const d = await signedInDevice();
    const res = await post("/api/auth/refresh", {
      headers: { origin: ORIGIN, cookie: `__Secure-pp_rt=${d.refreshToken}` },
    });
    expect(res.status).toBe(204);
    const [at, rt, signedIn] = res.headers.getSetCookie();
    expect(at).toMatch(/^__Host-pp_at=[\w-]+\.[\w-]+\.[\w-]+; Max-Age=900; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    expect(rt).toMatch(/^__Secure-pp_rt=[\w-]+; Max-Age=5184000; Path=\/api\/auth; HttpOnly; Secure; SameSite=Lax$/);
    expect(rt).not.toContain(d.refreshToken);
    expect(signedIn).toBe("pp_signed_in=1; Max-Age=5184000; Path=/; Secure; SameSite=Lax");
  });

  it("(cookie) failure clears cookies", async () => {
    const res = await post("/api/auth/refresh", { headers: { origin: ORIGIN, cookie: "__Secure-pp_rt=bogus" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(res.headers.getSetCookie()).toEqual([
      "__Host-pp_at=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      "__Secure-pp_rt=; Max-Age=0; Path=/api/auth; HttpOnly; Secure; SameSite=Lax",
      "pp_signed_in=; Max-Age=0; Path=/; Secure; SameSite=Lax",
    ]);
  });

  it("(cookie) with no cookie at all is 401", async () => {
    expect((await post("/api/auth/refresh", { headers: { origin: ORIGIN } })).status).toBe(401);
  });

  it("(cookie) with a foreign Origin is 403 bad_origin and rotates nothing", async () => {
    const d = await signedInDevice();
    const res = await post("/api/auth/refresh", {
      headers: { origin: "https://evil.example", cookie: `__Secure-pp_rt=${d.refreshToken}` },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad_origin" });
    expect((await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } })).status).toBe(200);
  });
});

describe("POST /api/auth/signout", () => {
  it("revokes the device; its refresh token then 401", async () => {
    const d = await signedInDevice();
    const res = await post("/api/auth/signout", { headers: { authorization: `Bearer ${d.accessToken}` } });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect((await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } })).status).toBe(401);
  });

  it("only revokes the calling device", async () => {
    const d = await signedInDevice();
    const other = await createDevice(env, d.userId, "Tablet", Date.now());
    await post("/api/auth/signout", { headers: { authorization: `Bearer ${d.accessToken}` } });
    expect((await post("/api/auth/refresh", { body: { refreshToken: other.refreshToken } })).status).toBe(200);
  });

  it("without credentials is 401", async () => {
    const res = await post("/api/auth/signout");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("with an invalid bearer is 401 even when a valid cookie is present", async () => {
    const d = await signedInDevice();
    const res = await post("/api/auth/signout", {
      headers: { authorization: "Bearer nope", cookie: `__Host-pp_at=${d.accessToken}`, origin: ORIGIN },
    });
    expect(res.status).toBe(401);
  });

  it("(cookie) revokes and clears all three cookies", async () => {
    const d = await signedInDevice();
    const res = await post("/api/auth/signout", { headers: { origin: ORIGIN, cookie: `__Host-pp_at=${d.accessToken}` } });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toHaveLength(3);
    expect(res.headers.getSetCookie().every((c) => c.includes("Max-Age=0"))).toBe(true);
    expect((await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } })).status).toBe(401);
  });

  it("cookie POST with foreign Origin -> 403 bad_origin", async () => {
    const d = await signedInDevice();
    for (const headers of <Record<string, string>[]>[
      { origin: "https://evil.example", cookie: `__Host-pp_at=${d.accessToken}` },
      { cookie: `__Host-pp_at=${d.accessToken}` },
    ]) {
      const res = await post("/api/auth/signout", { headers });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "bad_origin" });
    }
    // Nothing was revoked.
    expect((await post("/api/auth/refresh", { body: { refreshToken: d.refreshToken } })).status).toBe(200);
  });

  it("bearer POST without Origin is allowed", async () => {
    const d = await signedInDevice();
    expect((await post("/api/auth/signout", { headers: { authorization: `Bearer ${d.accessToken}` } })).status).toBe(204);
  });
});
