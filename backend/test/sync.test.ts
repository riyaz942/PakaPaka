import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueAccessToken } from "../src/accessToken";
import type { Deps } from "../src/deps";
import type { Env } from "../src/env";
import { handlePutSync } from "../src/routes/sync";
import { createDevice, findOrCreateUser } from "../src/sessions";

const ORIGIN = "https://paka-paka.app";

async function signedIn(sub = "g-1") {
  const now = Date.now();
  const userId = await findOrCreateUser(env.DB, "google", sub, now);
  const { deviceId } = await createDevice(env, userId, "Phone", now);
  const accessToken = await issueAccessToken(env, userId, deviceId, now);
  return { userId, deviceId, accessToken };
}

async function syncFile(marker = "m"): Promise<Uint8Array> {
  const text =
    '{"format":"pakapaka-backup","formatVersion":1,"schemaVersion":22,"curriculumVersion":null,' +
    `"exportedAt":"2026-11-17T00:00:00.000Z","includesConversations":false,"data":{"marker":"${marker}"}}`;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function put(accessToken: string | undefined, query: string, body: BodyInit) {
  return SELF.fetch(`${ORIGIN}/api/sync${query}`, {
    method: "PUT",
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    body,
  });
}

function get(accessToken: string | undefined, query: string) {
  return SELF.fetch(`${ORIGIN}/api/sync${query}`, {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

const keysOf = async (userId: string) =>
  (await env.PROGRESS.list({ prefix: `progress/${userId}/` })).objects.map((o) => o.key);

const syncRow = (userId: string) =>
  env.DB.prepare("SELECT revision, object_key FROM sync_state WHERE user_id = ?")
    .bind(userId)
    .first<{ revision: number; object_key: string }>();

beforeEach(async () => {
  await env.DB.batch(
    ["refresh_tokens", "sync_state", "identities", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
  const { objects } = await env.PROGRESS.list();
  if (objects.length) await env.PROGRESS.delete(objects.map((o) => o.key));
});

afterEach(() => vi.restoreAllMocks());

describe("GET /api/sync", () => {
  it("GET with no file → 204 and X-Sync-Revision 0", async () => {
    const a = await signedIn();
    const res = await get(a.accessToken, "?have=0");
    expect(res.status).toBe(204);
    expect(res.headers.get("x-sync-revision")).toBe("0");
  });

  it("first PUT with base_revision 0 → 200 revision 1; GET have=0 → 200 with the same bytes and X-Sync-Revision 1", async () => {
    const a = await signedIn();
    const body = await syncFile("first");
    const res = await put(a.accessToken, "?base_revision=0", body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revision: 1 });

    const got = await get(a.accessToken, "?have=0");
    expect(got.status).toBe(200);
    expect(got.headers.get("x-sync-revision")).toBe("1");
    expect(got.headers.get("content-type")).toBe("application/gzip");
    expect(got.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(body);
    expect((await syncRow(a.userId))?.revision).toBe(1);
  });

  it("GET have=1 after revision 1 → 204 and X-Sync-Revision 1", async () => {
    const a = await signedIn();
    expect((await put(a.accessToken, "?base_revision=0", await syncFile())).status).toBe(200);
    const res = await get(a.accessToken, "?have=1");
    expect(res.status).toBe(204);
    expect(res.headers.get("x-sync-revision")).toBe("1");
  });

  it.each(["", "?have=", "?have=-1", "?have=1.5", "?have=abc"])("bad have %s → 400", async (query) => {
    const a = await signedIn();
    const res = await get(a.accessToken, query);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_payload" });
  });

  it("GET without auth → 401", async () => {
    const res = await get(undefined, "?have=0");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("another user's file is never returned", async () => {
    const a = await signedIn("g-1");
    const b = await signedIn("g-2");
    expect((await put(a.accessToken, "?base_revision=0", await syncFile())).status).toBe(200);
    const res = await get(b.accessToken, "?have=0");
    expect(res.status).toBe(204);
    expect(res.headers.get("x-sync-revision")).toBe("0");
  });
});

describe("PUT /api/sync", () => {
  it("PUT with a stale base_revision → 409 with the current revision and no R2 object left behind", async () => {
    const a = await signedIn();
    expect((await put(a.accessToken, "?base_revision=0", await syncFile())).status).toBe(200);
    expect((await put(a.accessToken, "?base_revision=1", await syncFile())).status).toBe(200);
    const before = await keysOf(a.userId);

    const res = await put(a.accessToken, "?base_revision=1", await syncFile("stale"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "revision_conflict", revision: 2 });
    expect(await keysOf(a.userId)).toEqual(before);
  });

  it("concurrent PUTs: one wins and GET returns the winner's bytes", async () => {
    const a = await signedIn();
    expect((await put(a.accessToken, "?base_revision=0", await syncFile())).status).toBe(200);
    const bodies = [await syncFile("left"), await syncFile("right")];

    const results = await Promise.all(bodies.map((b) => put(a.accessToken, "?base_revision=1", b)));
    const statuses = results.map((r) => r.status);
    expect([...statuses].sort()).toEqual([200, 409]);
    const winner = bodies[statuses.indexOf(200)];
    expect(await results[statuses.indexOf(409)].json()).toEqual({ error: "revision_conflict", revision: 2 });

    const got = await get(a.accessToken, "?have=1");
    expect(got.status).toBe(200);
    expect(got.headers.get("x-sync-revision")).toBe("2");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(winner);
    const rev2 = (await keysOf(a.userId)).filter((k) => k.startsWith(`progress/${a.userId}/0000000002-`));
    expect(rev2).toHaveLength(1);
  });

  it("keeps the current file and the previous 3", async () => {
    const a = await signedIn();
    for (let base = 0; base < 5; base++) {
      expect((await put(a.accessToken, `?base_revision=${base}`, await syncFile(`v${base}`))).status).toBe(200);
    }
    const prefix = `progress/${a.userId}/`;
    const revisions = (await keysOf(a.userId)).map((k) => Number(k.slice(prefix.length, prefix.length + 10)));
    expect(revisions.sort()).toEqual([2, 3, 4, 5]);
    const row = await syncRow(a.userId);
    expect(row?.revision).toBe(5);
    expect(row?.object_key).toMatch(new RegExp(`^progress/${a.userId}/0000000005-[0-9a-f-]{36}\\.json\\.gz$`));
  });

  it("PUT without auth → 401", async () => {
    const res = await put(undefined, "?base_revision=0", await syncFile());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("cookie PUT with a foreign Origin → 403", async () => {
    const a = await signedIn();
    const res = await SELF.fetch(`${ORIGIN}/api/sync?base_revision=0`, {
      method: "PUT",
      headers: { cookie: `__Host-pp_at=${a.accessToken}`, origin: "https://evil.example" },
      body: await syncFile(),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "bad_origin" });
    expect(await keysOf(a.userId)).toEqual([]);
  });

  it("PUT after the users row is deleted → 401 and no R2 object, no sync_state row", async () => {
    const a = await signedIn();
    await env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(a.userId).run();
    const res = await put(a.accessToken, "?base_revision=0", await syncFile());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(await keysOf(a.userId)).toEqual([]);
    expect(await syncRow(a.userId)).toBeNull();
  });

  it("PUT larger than 2,000,000 bytes → 413", async () => {
    const a = await signedIn();
    const big = new Uint8Array(2_000_001);
    big[0] = 0x1f;
    big[1] = 0x8b;
    const res = await put(a.accessToken, "?base_revision=0", big);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload_too_large" });
  });

  it("non-gzip → 400", async () => {
    const a = await signedIn();
    const res = await put(a.accessToken, "?base_revision=0", "not gzip");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_payload" });
  });

  it("gzip with a wrong envelope → 400", async () => {
    const a = await signedIn();
    const stream = new Blob(['{"hello":"world"}']).stream().pipeThrough(new CompressionStream("gzip"));
    const res = await put(a.accessToken, "?base_revision=0", new Uint8Array(await new Response(stream).arrayBuffer()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_payload" });
    expect(await keysOf(a.userId)).toEqual([]);
  });

  it("missing base_revision → 400", async () => {
    const a = await signedIn();
    const res = await put(a.accessToken, "", await syncFile());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_payload" });
  });

  it("7th PUT in a minute → 429", async () => {
    const a = await signedIn();
    let calls = 0;
    const limiter = { limit: async () => ({ success: ++calls <= 6 }) } as unknown as RateLimit;
    const fakeEnv = { ...env, UPLOAD_LIMITER: limiter } as Env;
    const deps = { now: () => Date.now() } as Deps;
    const req = async (base: number) =>
      new Request(`${ORIGIN}/api/sync?base_revision=${base}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${a.accessToken}` },
        body: await syncFile(`v${base}`),
      });
    for (let base = 0; base < 6; base++) {
      expect((await handlePutSync(await req(base), fakeEnv, deps)).status).toBe(200);
    }
    const res = await handlePutSync(await req(6), fakeEnv, deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect((await syncRow(a.userId))?.revision).toBe(6);
  });
});

describe("account delete", () => {
  it("Delete account removes the sync files and the sync_state row", async () => {
    const a = await signedIn();
    expect((await put(a.accessToken, "?base_revision=0", await syncFile())).status).toBe(200);
    expect(await keysOf(a.userId)).toHaveLength(1);
    expect(await syncRow(a.userId)).not.toBeNull();

    const res = await SELF.fetch(`${ORIGIN}/api/account`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${a.accessToken}` },
    });
    expect(res.status).toBe(204);
    expect(await keysOf(a.userId)).toEqual([]);
    expect(await syncRow(a.userId)).toBeNull();
  });
});

describe("logging", () => {
  it("no body bytes and no token appear in console output", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const a = await signedIn();
    const body = await syncFile("SECRET-BODY-MARKER");
    expect((await put(a.accessToken, "?base_revision=0", body)).status).toBe(200);
    expect((await get(a.accessToken, "?have=0")).status).toBe(200);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(a.accessToken);
    expect(logged).not.toContain("SECRET-BODY-MARKER");
    expect(logged).not.toContain(JSON.stringify(Array.from(body.subarray(0, 16))).slice(1, -1));
  });
});
