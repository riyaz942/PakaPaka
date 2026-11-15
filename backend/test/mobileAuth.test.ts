import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Deps } from "../src/deps";
import { deviceLabelFromUserAgent } from "../src/deviceLabel";
import { rateLimit } from "../src/limits";
import { handleExchange, handleNonce } from "../src/routes/mobileAuth";
import { makeTestGoogle } from "./helpers";

const NOW = Date.now();

async function setup(nowMs = NOW) {
  const google = await makeTestGoogle();
  const deps: Deps = { now: () => nowMs, fetch, googleJwks: google.jwks };
  const newNonce = async () =>
    ((await (await handleNonce(new Request("https://paka-paka.app/api/auth/nonce", { method: "POST" }), env, deps)).json()) as {
      nonce: string;
    }).nonce;
  const exchange = (body: unknown, d: Deps = deps) =>
    handleExchange(
      new Request("https://paka-paka.app/api/auth/exchange", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }),
      env,
      d,
    );
  return { google, deps, newNonce, exchange };
}

beforeEach(async () => {
  await env.DB.batch(
    ["refresh_tokens", "sync_state", "identities", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/auth/nonce", () => {
  it("returns a signed nonce", async () => {
    const res = await SELF.fetch("https://paka-paka.app/api/auth/nonce", {
      method: "POST",
      headers: { "cf-connecting-ip": "10.0.0.1" },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { nonce: string }).nonce).toMatch(/^[\w-]+\.[0-9a-f]{64}$/);
  });
});

describe("handleExchange", () => {
  it("returns tokens and the same user on a second sign-in", async () => {
    const { google, newNonce, exchange } = await setup();
    const signIn = async () => {
      const nonce = await newNonce();
      const res = await exchange({ provider: "google", idToken: await google.sign({ nonce }), nonce, deviceLabel: "  Pixel  " });
      expect(res.status).toBe(200);
      return (await res.json()) as { accessToken: string; refreshToken: string; deviceId: string; provider: string };
    };
    const a = await signIn();
    const b = await signIn();
    expect(a.provider).toBe("google");
    expect(a.accessToken.split(".")).toHaveLength(3);
    expect(a.deviceId).not.toBe(b.deviceId);
    const users = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    expect(users?.n).toBe(1);
    const label = await env.DB.prepare("SELECT DISTINCT device_label AS l FROM refresh_tokens").first<{ l: string }>();
    expect(label?.l).toBe("Pixel");
  });

  it("uses Phone for an empty label and caps labels at 60 chars", async () => {
    const { google, newNonce, exchange } = await setup();
    for (const deviceLabel of ["   ", "x".repeat(100)]) {
      const nonce = await newNonce();
      expect((await exchange({ provider: "google", idToken: await google.sign({ nonce }), nonce, deviceLabel })).status).toBe(200);
    }
    const { results } = await env.DB.prepare("SELECT device_label AS l FROM refresh_tokens ORDER BY created_at, rowid").all<{ l: string }>();
    expect(results.map((r) => r.l).sort()).toEqual(["Phone", "x".repeat(60)].sort());
  });

  it("rejects a nonce we did not sign", async () => {
    const { google, exchange } = await setup();
    const nonce = "forged.nonce";
    const res = await exchange({ provider: "google", idToken: await google.sign({ nonce }), nonce, deviceLabel: "Phone" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_nonce" });
  });

  it("rejects an expired nonce", async () => {
    const { google, newNonce, deps, exchange } = await setup();
    const nonce = await newNonce();
    const res = await exchange(
      { provider: "google", idToken: await google.sign({ nonce }), nonce, deviceLabel: "Phone" },
      { ...deps, now: () => NOW + 600_001 },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_nonce" });
  });

  it("rejects an id token whose nonce differs", async () => {
    const { google, newNonce, exchange } = await setup();
    const nonce = await newNonce();
    const res = await exchange({ provider: "google", idToken: await google.sign({ nonce: "other" }), nonce, deviceLabel: "Phone" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_nonce" });
  });

  it("rejects a bad id token with 401 invalid_token", async () => {
    const { newNonce, exchange } = await setup();
    const nonce = await newNonce();
    const res = await exchange({ provider: "google", idToken: "not-a-jwt", nonce, deviceLabel: "Phone" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_token" });
  });

  it("maps a Google outage to 502 server_error", async () => {
    const { google, newNonce, deps, exchange } = await setup();
    const nonce = await newNonce();
    const res = await exchange(
      { provider: "google", idToken: await google.sign({ nonce }), nonce, deviceLabel: "Phone" },
      {
        ...deps,
        googleJwks: (async () => {
          throw new TypeError("fetch failed");
        }) as unknown as Deps["googleJwks"],
      },
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "server_error" });
  });

  it.each([
    ["missing idToken", { provider: "google", nonce: "n", deviceLabel: "p" }],
    ["non-string nonce", { provider: "google", idToken: "t", nonce: 1, deviceLabel: "p" }],
    ["missing deviceLabel", { provider: "google", idToken: "t", nonce: "n" }],
    ["other provider", { provider: "apple", idToken: "t", nonce: "n", deviceLabel: "p" }],
    ["not json", "{nope"],
    ["null body", "null"],
  ])("rejects %s with 400 invalid_token", async (_name, body) => {
    const { exchange } = await setup();
    const res = await exchange(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_token" });
  });

  it("rejects a body over 8 KB with 413", async () => {
    const { exchange } = await setup();
    const res = await exchange({ provider: "google", idToken: "x".repeat(9000), nonce: "n", deviceLabel: "p" });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload_too_large" });
  });
});

describe("rate limit", () => {
  it("rateLimit returns 429 rate_limited when the limiter refuses", async () => {
    const res = await rateLimit({ limit: async () => ({ success: false }) }, "ip");
    expect(res?.status).toBe(429);
    expect(await res?.json()).toEqual({ error: "rate_limited" });
  });

  it("rateLimit passes when the limiter allows", async () => {
    expect(await rateLimit({ limit: async () => ({ success: true }) }, "ip")).toBeNull();
  });

  it("11th auth request in a window from one IP gets 429", async () => {
    const hit = () =>
      SELF.fetch("https://paka-paka.app/api/auth/nonce", { method: "POST", headers: { "cf-connecting-ip": "10.9.9.9" } });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await hit()).status);
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
    // A different IP has its own budget.
    expect(
      (await SELF.fetch("https://paka-paka.app/api/auth/nonce", { method: "POST", headers: { "cf-connecting-ip": "10.9.9.8" } })).status,
    ).toBe(200);
  });
});

describe("deviceLabelFromUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Chrome on macOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Safari on iOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0", "Edge on Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox on Linux"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", "Chrome on Android"],
    ["Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Chrome on ChromeOS"],
    ["curl/8.0", "Web browser"],
    ["", "Web browser"],
    [null, "Web browser"],
  ])("%s -> %s", (ua, expected) => {
    expect(deviceLabelFromUserAgent(ua)).toBe(expected);
  });
});

describe("logging", () => {
  it("no token value appears in console output", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const { google, newNonce, exchange } = await setup();
    const nonce = await newNonce();
    const idToken = await google.sign({ nonce });
    const res = await exchange({ provider: "google", idToken, nonce, deviceLabel: "Phone" });
    const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
    const refreshed = await SELF.fetch("https://paka-paka.app/api/auth/refresh", {
      method: "POST",
      headers: { "cf-connecting-ip": "10.0.0.2" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    const rotated = (await refreshed.json()) as { accessToken: string; refreshToken: string };
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const secret of [idToken, nonce, tokens.accessToken, tokens.refreshToken, rotated.accessToken, rotated.refreshToken]) {
      expect(logged).not.toContain(secret);
    }
  });
});
