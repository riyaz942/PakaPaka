import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { issueAccessToken, verifyAccessToken } from "../src/accessToken";
import { hmacHex, randomToken, sha256Base64Url, signValue, verifySignedValue } from "../src/crypto";

describe("signed values", () => {
  it("signed value round-trips before expiry", async () => {
    const v = await signValue("k", { a: 1, b: "x" }, 10_000);
    expect(await verifySignedValue<{ a: number; b: string }>("k", v, 10_000)).toEqual({ a: 1, b: "x" });
  });

  it("signed value is null after expiry", async () => {
    const v = await signValue("k", { a: 1 }, 10_000);
    expect(await verifySignedValue("k", v, 10_001)).toBeNull();
  });

  it("signed value is null when one character changes", async () => {
    const v = await signValue("k", { a: 1 }, 10_000);
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === "a" ? "b" : "a") + s.slice(i + 1);
    expect(await verifySignedValue("k", flip(v, 0), 0)).toBeNull();
    expect(await verifySignedValue("k", flip(v, v.length - 1), 0)).toBeNull();
    expect(await verifySignedValue("other", v, 0)).toBeNull();
  });
});

describe("primitives", () => {
  it("hmacHex is stable and 64 hex chars", async () => {
    const a = await hmacHex("key", "data");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hmacHex("key", "data")).toBe(a);
    expect(await hmacHex("key", "other")).not.toBe(a);
  });

  it("randomToken(32) is 43 chars base64url", () => {
    const t = randomToken(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(t);
  });

  it("sha256Base64Url('abc') === 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0'", async () => {
    expect(await sha256Base64Url("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });
});

describe("access token", () => {
  const t0 = 1_800_000_000_000;

  it("access token verifies at 899 s and fails at 901 s", async () => {
    const token = await issueAccessToken(env, "u1", "d1", t0);
    expect(await verifyAccessToken(env, token, t0 + 899_000)).toEqual({ userId: "u1", deviceId: "d1" });
    expect(await verifyAccessToken(env, token, t0 + 901_000)).toBeNull();
  });

  it("access token signed with another key fails", async () => {
    const token = await issueAccessToken({ ...env, SESSION_SIGNING_KEY: "another-key-0123456789abcdef-xyz" }, "u1", "d1", t0);
    expect(await verifyAccessToken(env, token, t0)).toBeNull();
  });
});
