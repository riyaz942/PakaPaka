import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";

const HEX = "a".repeat(64);
const MANIFEST = '{"version":"1.2.3"}';
const FILE_BYTES = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x00, 0xff]);
const BASE = "https://paka-paka.app/api/curriculum";

async function clearBuckets() {
  for (const bucket of [env.CURRICULUM, env.PROGRESS]) {
    const { objects } = await bucket.list();
    if (objects.length) await bucket.delete(objects.map((o) => o.key));
  }
}

async function seed() {
  await env.CURRICULUM.put("s1/manifest.json", MANIFEST);
  await env.CURRICULUM.put(`files/${HEX}.db`, FILE_BYTES);
}

beforeEach(async () => {
  await clearBuckets();
  await seed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/curriculum", () => {
  it("manifest: 200, the stored bytes, JSON type, max-age=300", async () => {
    const res = await SELF.fetch(`${BASE}/s1/manifest.json`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(MANIFEST);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("etag")).toBeTruthy();
  });

  it("file: 200, the stored bytes, sqlite type, immutable cache, Content-Length", async () => {
    const res = await SELF.fetch(`${BASE}/files/${HEX}.db`);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FILE_BYTES);
    expect(res.headers.get("content-type")).toBe("application/vnd.sqlite3");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("content-length")).toBe(String(FILE_BYTES.byteLength));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("etag")).toBeTruthy();
  });

  it("missing manifest -> 404 not_found with no-store", async () => {
    const res = await SELF.fetch(`${BASE}/s2/manifest.json`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("missing file -> 404", async () => {
    const res = await SELF.fetch(`${BASE}/files/${"b".repeat(64)}.db`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("bad paths -> 404", async () => {
    const paths = [
      "/api/curriculum/s0/manifest.json",
      "/api/curriculum/s1/../manifest.json",
      "/api/curriculum/files/ABC.db",
      `/api/curriculum/files/${"a".repeat(63)}.db`,
      "/api/curriculum/",
      "/api/curriculum/s1/manifest.json/x",
    ];
    for (const p of paths) {
      const res = await SELF.fetch(`https://paka-paka.app${p}`);
      expect(res.status, p).toBe(404);
      expect(res.headers.get("cache-control"), p).toBe("no-store");
      await res.arrayBuffer();
    }
  });

  it("POST and PUT -> 404 and nothing written", async () => {
    const before = (await env.CURRICULUM.list()).objects.map((o) => o.key).sort();
    for (const method of ["POST", "PUT"]) {
      const res = await SELF.fetch(`${BASE}/files/${"c".repeat(64)}.db`, { method, body: "x" });
      expect(res.status, method).toBe(404);
      expect(res.headers.get("cache-control"), method).toBe("no-store");
      await res.arrayBuffer();
    }
    const after = (await env.CURRICULUM.list()).objects.map((o) => o.key).sort();
    expect(after).toEqual(before);
  });

  it("works with no cookie and ignores a cookie and an Authorization header", async () => {
    const plain = await SELF.fetch(`${BASE}/s1/manifest.json`);
    const withHeaders = await SELF.fetch(`${BASE}/s1/manifest.json`, {
      headers: { cookie: "pp_session=abc; other=1", authorization: "Bearer not-a-token" },
    });
    expect(withHeaders.status).toBe(200);
    expect(await withHeaders.text()).toBe(await plain.text());
  });

  it("does not read the progress bucket", async () => {
    await env.PROGRESS.put("progress/u1/x", "secret");
    await env.PROGRESS.put(`files/${"d".repeat(64)}.db`, "secret");
    const res = await SELF.fetch(`${BASE}/files/${"d".repeat(64)}.db`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("secret");
  });

  it("no console output", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    await (await SELF.fetch(`${BASE}/s1/manifest.json`)).arrayBuffer();
    await (await SELF.fetch(`${BASE}/files/${HEX}.db`)).arrayBuffer();
    await (await SELF.fetch(`${BASE}/s9/manifest.json`)).arrayBuffer();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("curriculum requests do not use the auth rate limiter", async () => {
    let calls = 0;
    const fakeEnv = {
      ...env,
      AUTH_LIMITER: {
        limit: async () => {
          calls++;
          return { success: false };
        },
      },
    } as unknown as Env;
    const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
    for (let i = 0; i < 20; i++) {
      const res = await worker.fetch(new Request(`${BASE}/s1/manifest.json`), fakeEnv, ctx);
      expect(res.status).toBe(200);
      await res.arrayBuffer();
    }
    expect(calls).toBe(0);
  });
});
