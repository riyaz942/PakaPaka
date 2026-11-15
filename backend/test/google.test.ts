import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Deps } from "../src/deps";
import { buildGoogleAuthUrl, exchangeGoogleCode, googleAudiences, verifyGoogleIdToken } from "../src/google";
import { makeTestGoogle } from "./helpers";

const nowMs = 1_800_000_000_000;
const nowS = nowMs / 1000;
const base = { iat: nowS, exp: nowS + 3600, nonce: "n1" };

async function verify(claims: Parameters<Awaited<ReturnType<typeof makeTestGoogle>>["sign"]>[0], nonce = "n1") {
  const g = await makeTestGoogle();
  return verifyGoogleIdToken(await g.sign({ ...base, ...claims }), {
    jwks: g.jwks,
    audiences: googleAudiences(env),
    expectedNonce: nonce,
    nowMs,
  });
}

describe("verifyGoogleIdToken", () => {
  it("accepts a valid token", async () => {
    expect(await verify({})).toEqual({ ok: true, value: { sub: "g-123" } });
  });

  it("accepts aud from GOOGLE_IOS_CLIENT_IDS", async () => {
    expect(await verify({ aud: "ios-b" })).toEqual({ ok: true, value: { sub: "g-123" } });
  });

  it("rejects wrong aud", async () => {
    expect(await verify({ aud: "someone-else" })).toEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects wrong iss", async () => {
    expect(await verify({ iss: "https://evil.example" })).toEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects expired (exp 31 s in the past)", async () => {
    expect(await verify({ exp: nowS - 31 })).toEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects a token signed by another key", async () => {
    const real = await makeTestGoogle();
    const other = await makeTestGoogle();
    const r = await verifyGoogleIdToken(await other.sign(base), {
      jwks: real.jwks,
      audiences: googleAudiences(env),
      expectedNonce: "n1",
      nowMs,
    });
    expect(r).toEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects a token without exp", async () => {
    expect(await verify({ exp: undefined })).toEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects a token with empty sub", async () => {
    expect(await verify({ sub: "" })).toEqual({ ok: false, error: "invalid_token" });
  });

  it("maps a JWKS fetch failure to upstream_failed", async () => {
    const g = await makeTestGoogle();
    const r = await verifyGoogleIdToken(await g.sign(base), {
      jwks: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof g.jwks,
      audiences: googleAudiences(env),
      expectedNonce: "n1",
      nowMs,
    });
    expect(r).toEqual({ ok: false, error: "upstream_failed" });
  });

  it("rejects nonce mismatch with invalid_nonce", async () => {
    expect(await verify({}, "other")).toEqual({ ok: false, error: "invalid_nonce" });
  });

  it("rejects missing nonce with invalid_nonce", async () => {
    expect(await verify({ nonce: undefined })).toEqual({ ok: false, error: "invalid_nonce" });
  });
});

describe("googleAudiences", () => {
  it("lists web then trimmed iOS ids", () => {
    expect(googleAudiences({ ...env, GOOGLE_IOS_CLIENT_IDS: " ios-a , ,ios-b" })).toEqual([
      "web-client",
      "ios-a",
      "ios-b",
    ]);
  });
});

describe("buildGoogleAuthUrl", () => {
  it("has scope=openid and no email scope", () => {
    const u = new URL(buildGoogleAuthUrl(env, { state: "s", nonce: "n", codeChallenge: "c" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe("openid");
    expect(u.search).not.toContain("email");
    expect(u.searchParams.get("client_id")).toBe("web-client");
    expect(u.searchParams.get("redirect_uri")).toBe("https://paka-paka.app/api/auth/google/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("s");
    expect(u.searchParams.get("nonce")).toBe("n");
    expect(u.searchParams.get("code_challenge")).toBe("c");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("exchangeGoogleCode", () => {
  function depsWith(res: Response, captured: { url?: string; init?: RequestInit } = {}): Deps {
    return {
      now: () => nowMs,
      fetch: (async (url: string, init?: RequestInit) => {
        captured.url = url;
        captured.init = init;
        return res;
      }) as unknown as typeof fetch,
      googleJwks: (async () => {
        throw new Error("unused");
      }) as unknown as Deps["googleJwks"],
    };
  }

  it("posts code_verifier and client_secret and returns id_token", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const deps = depsWith(Response.json({ id_token: "the-id-token" }), captured);
    const r = await exchangeGoogleCode(env, deps, { code: "abc", codeVerifier: "ver" });
    expect(r).toEqual({ ok: true, value: "the-id-token" });
    expect(captured.url).toBe("https://oauth2.googleapis.com/token");
    expect(captured.init?.method).toBe("POST");
    const body = new URLSearchParams(String(captured.init?.body));
    expect(body.get("code")).toBe("abc");
    expect(body.get("code_verifier")).toBe("ver");
    expect(body.get("client_id")).toBe("web-client");
    expect(body.get("client_secret")).toBe("test-google-secret");
    expect(body.get("redirect_uri")).toBe("https://paka-paka.app/api/auth/google/callback");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("fetch rejection → upstream_failed", async () => {
    const deps = depsWith(new Response());
    deps.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await exchangeGoogleCode(env, deps, { code: "abc", codeVerifier: "ver" })).toEqual({
      ok: false,
      error: "upstream_failed",
    });
  });

  it("503 → upstream_failed", async () => {
    const deps = depsWith(new Response("down", { status: 503 }));
    expect(await exchangeGoogleCode(env, deps, { code: "abc", codeVerifier: "ver" })).toEqual({
      ok: false,
      error: "upstream_failed",
    });
  });

  it("200 without id_token → invalid_token", async () => {
    const deps = depsWith(Response.json({ access_token: "x" }));
    expect(await exchangeGoogleCode(env, deps, { code: "abc", codeVerifier: "ver" })).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("non-200 → invalid_token", async () => {
    const deps = depsWith(new Response("nope", { status: 400 }));
    expect(await exchangeGoogleCode(env, deps, { code: "abc", codeVerifier: "ver" })).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });
});
