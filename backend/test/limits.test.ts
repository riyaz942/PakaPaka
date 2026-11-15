import { afterEach, describe, expect, it, vi } from "vitest";
import { checkUploadBody, toServerErrorResponse, uploadRateLimit } from "../src/limits";

function gzipLike(size: number): Uint8Array {
  const b = new Uint8Array(size);
  b[0] = 0x1f;
  b[1] = 0x8b;
  return b;
}

function post(body: BodyInit, headers?: HeadersInit): Request {
  return new Request("https://paka-paka.app/x", { method: "POST", body, headers, duplex: "half" } as RequestInit);
}

describe("checkUploadBody", () => {
  it("2,000,000-byte gzip body passes", async () => {
    const res = await checkUploadBody(post(gzipLike(2_000_000)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.byteLength).toBe(2_000_000);
  });

  it("2,000,001 bytes -> payload_too_large", async () => {
    expect(await checkUploadBody(post(gzipLike(2_000_001)))).toEqual({ ok: false, error: "payload_too_large" });
  });

  it("lying Content-Length (small header, large stream) -> payload_too_large", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(gzipLike(64 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const res = await checkUploadBody(post(stream, { "content-length": "10" }));
    expect(res).toEqual({ ok: false, error: "payload_too_large" });
    expect(cancelled).toBe(true);
  });

  it("non-gzip -> bad_payload", async () => {
    expect(await checkUploadBody(post("not gzip at all"))).toEqual({ ok: false, error: "bad_payload" });
    expect(await checkUploadBody(post(new Uint8Array([0x1f])))).toEqual({ ok: false, error: "bad_payload" });
    expect(await checkUploadBody(new Request("https://paka-paka.app/x", { method: "POST" }))).toEqual({
      ok: false,
      error: "bad_payload",
    });
  });
});

describe("uploadRateLimit", () => {
  it("upload limiter false -> 429", async () => {
    const keys: string[] = [];
    const env = {
      UPLOAD_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: false };
        },
      },
    };
    const res = await uploadRateLimit(env, "user-1");
    expect(res?.status).toBe(429);
    expect(await res?.json()).toEqual({ error: "rate_limited" });
    expect(keys).toEqual(["user-1"]);
  });

  it("passes when the limiter allows", async () => {
    expect(await uploadRateLimit({ UPLOAD_LIMITER: { limit: async () => ({ success: true }) } }, "u")).toBeNull();
  });
});

describe("toServerErrorResponse", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    "D1_ERROR: Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.",
    "Your account has exceeded D1's free tier daily row write limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.",
    "Your account has exceeded D1's maximum account storage limit, please contact Cloudflare to raise your limit",
    "Exceeded maximum DB size.",
  ])("quota error -> 503 quota_exceeded: %s", async (message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toServerErrorResponse(new Error(message));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "quota_exceeded" });
  });

  it("quota text in err.cause -> 503 quota_exceeded", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("D1_ERROR: query failed", {
      cause: new Error("Your account has exceeded D1's free tier daily row write limit."),
    });
    const res = toServerErrorResponse(err);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "quota_exceeded" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("exceeded");
  });

  it("non-object cause is ignored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toServerErrorResponse(new Error("x", { cause: "exceeded D1's free tier daily row write limit" })).status).toBe(500);
    expect(toServerErrorResponse(new Error("x", { cause: null })).status).toBe(500);
  });

  it("other error -> 500 server_error with no message leak", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "INSERT INTO users VALUES ('sub-SECRET-123')";
    const err = Object.assign(new TypeError(secret), { code: "E_BOOM" });
    const res = toServerErrorResponse(err);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "server_error" });
    expect(text).not.toContain("SECRET");
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain("TypeError");
    expect(logged).toContain("E_BOOM");
    expect(logged).not.toContain("SECRET");
  });

  it("handles non-Error throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toServerErrorResponse("boom").status).toBe(500);
    expect(toServerErrorResponse(null).status).toBe(500);
  });
});
