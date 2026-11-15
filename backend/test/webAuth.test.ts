import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "../src/deps";
import { sha256Base64Url, signValue, verifySignedValue } from "../src/crypto";
import { handleGoogleCallback, handleWebStart } from "../src/routes/webAuth";
import { TOKEN_CSS } from "../src/tokenCss.generated";
import { makeTestGoogle } from "./helpers";

const NOW = Date.now();
const ORIGIN = "https://paka-paka.app";
const OAUTH = "__Host-pp_oauth";

beforeEach(async () => {
  await env.DB.batch(
    ["refresh_tokens", "sync_state", "identities", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
});

describe("GET /auth/signin", () => {
  it("signin page has the CSP and no COEP header", async () => {
    const res = await SELF.fetch(`${ORIGIN}/auth/signin`, { headers: { "cf-connecting-ip": "10.1.0.1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; " +
        "style-src 'unsafe-inline'; connect-src 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("cross-origin-embedder-policy")).toBeNull();
    expect(res.headers.get("cross-origin-opener-policy")).toBeNull();
    const html = await res.text();
    expect(html).toContain("<title>Sign in to sync</title>");
    expect(html).toContain('class="cf-turnstile" data-sitekey="turnstile-site-key" data-callback="onTurnstileOk"');
    expect(html).toContain('<form method="post" action="/api/auth/web/start">');
    expect(html).toContain("Back to the app");
    expect(html).not.toContain("Check failed");
  });

  it("signin page CSS has no hex colors", async () => {
    const html = await (await SELF.fetch(`${ORIGIN}/auth/signin`, { headers: { "cf-connecting-ip": "10.1.0.2" } })).text();
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    expect(style).toContain("rgb(var(--color-background))");
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("shows the error line for turnstile and origin failures", async () => {
    for (const error of ["turnstile", "origin"]) {
      const res = await SELF.fetch(`${ORIGIN}/auth/signin?error=${error}`, { headers: { "cf-connecting-ip": "10.1.0.3" } });
      expect(await res.text()).toContain("Check failed. Try again.");
    }
  });

  it("serves the Turnstile callback script as JavaScript", async () => {
    const res = await SELF.fetch(`${ORIGIN}/auth/signin.js`, { headers: { "cf-connecting-ip": "10.1.0.4" } });
    expect(res.headers.get("content-type")).toContain("text/javascript");
    expect(await res.text()).toContain("window.onTurnstileOk");
  });
});

describe("token CSS", () => {
  it("tokenCss copies light and dark --color-background", () => {
    const [light, dark] = TOKEN_CSS.split("@media (prefers-color-scheme: dark)");
    expect(light).toMatch(/^:root\{[^}]*--color-background:247 245 242;/);
    expect(dark).toMatch(/^\{:root\{[^}]*--color-background:27 25 23;/);
  });
});

function siteverify(success: boolean | "throw") {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: new URLSearchParams(String(init?.body)) });
    if (success === "throw") throw new TypeError("network");
    return new Response(JSON.stringify({ success }));
  }) as typeof fetch;
  return { f, calls };
}

async function start(fetchImpl: typeof fetch, opts: { origin?: string | null; token?: string | null } = {}) {
  const google = await makeTestGoogle();
  const deps: Deps = { now: () => NOW, fetch: fetchImpl, googleJwks: google.jwks };
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "cf-connecting-ip": "203.0.113.9",
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
  const body = opts.token === null ? "" : new URLSearchParams({ "cf-turnstile-response": opts.token ?? "tok" }).toString();
  return handleWebStart(new Request(`${ORIGIN}/api/auth/web/start`, { method: "POST", headers, body }), env, deps);
}

describe("handleWebStart", () => {
  it("start with failed turnstile redirects to signin?error=turnstile and sets no cookie", async () => {
    const { f } = siteverify(false);
    const res = await start(f);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/auth/signin?error=turnstile");
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("a siteverify fetch failure counts as failed", async () => {
    const res = await start(siteverify("throw").f);
    expect(res.headers.get("location")).toBe("/auth/signin?error=turnstile");
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("a missing turnstile token fails without calling siteverify", async () => {
    const { f, calls } = siteverify(true);
    const res = await start(f, { token: null });
    expect(res.headers.get("location")).toBe("/auth/signin?error=turnstile");
    expect(calls).toHaveLength(0);
  });

  it("start with a foreign or missing Origin redirects to signin?error=origin and sets no cookie", async () => {
    for (const origin of ["https://evil.example", null]) {
      const { f, calls } = siteverify(true);
      const res = await start(f, { origin });
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/auth/signin?error=origin");
      expect(res.headers.getSetCookie()).toEqual([]);
      expect(calls).toHaveLength(0);
    }
  });

  it("start with passing turnstile sets the oauth cookie and redirects to Google with S256 challenge of the verifier", async () => {
    const { f, calls } = siteverify(true);
    const res = await start(f, { token: "the-token" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(Object.fromEntries(calls[0].body)).toEqual({
      secret: "test-turnstile-secret",
      response: "the-token",
      remoteip: "203.0.113.9",
    });

    expect(res.status).toBe(303);
    const [cookie] = res.headers.getSetCookie();
    expect(cookie).toMatch(/^__Host-pp_oauth=[^;]+; Max-Age=600; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    const value = cookie.slice(`${OAUTH}=`.length).split(";")[0];
    const saved = await verifySignedValue<{ p: string; state: string; verifier: string; nonce: string }>(env.HMAC_KEY, value, NOW);
    expect(saved?.p).toBe("oauth");

    const url = new URL(res.headers.get("location")!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await sha256Base64Url(saved!.verifier));
    expect(url.searchParams.get("state")).toBe(saved!.state);
    expect(url.searchParams.get("nonce")).toBe(saved!.nonce);
    expect(url.searchParams.get("scope")).toBe("openid");
  });
});

const STATE = "state-1";
const VERIFIER = "verifier-1";
const NONCE = "nonce-1";

async function callback(
  opts: {
    query?: string;
    cookie?: string | null;
    idNonce?: string;
    tokenStatus?: number;
    throwOnFetch?: boolean;
    jwksFails?: boolean;
  } = {},
) {
  const google = await makeTestGoogle();
  const exchanged: URLSearchParams[] = [];
  const f = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    exchanged.push(new URLSearchParams(String(init?.body)));
    if (opts.throwOnFetch) throw new TypeError("network");
    if (opts.tokenStatus) return new Response("{}", { status: opts.tokenStatus });
    return new Response(JSON.stringify({ id_token: await google.sign({ nonce: opts.idNonce ?? NONCE }) }));
  }) as typeof fetch;
  const jwks = opts.jwksFails
    ? ((async () => {
        throw new TypeError("jwks down");
      }) as unknown as Deps["googleJwks"])
    : google.jwks;
  const deps: Deps = { now: () => NOW, fetch: f, googleJwks: jwks };
  const cookie =
    opts.cookie === undefined
      ? `${OAUTH}=${await signValue(env.HMAC_KEY, { p: "oauth", state: STATE, verifier: VERIFIER, nonce: NONCE }, NOW + 600_000)}`
      : opts.cookie;
  const headers: Record<string, string> = { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36" };
  if (cookie) headers.cookie = cookie;
  const res = await handleGoogleCallback(
    new Request(`${ORIGIN}/api/auth/google/callback?${opts.query ?? `code=c1&state=${STATE}`}`, { headers }),
    env,
    deps,
  );
  return { res, exchanged };
}

function expectRejected(res: Response, location: string) {
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(location);
  const cookies = res.headers.getSetCookie();
  expect(cookies.some((c) => c.startsWith("__Host-pp_at="))).toBe(false);
  expect(cookies).toHaveLength(1);
  expect(cookies[0]).toMatch(/^__Host-pp_oauth=; Max-Age=0; Path=\//);
}

describe("handleGoogleCallback", () => {
  it("callback success sets three session cookies and redirects to /settings?signin=ok", async () => {
    const { res, exchanged } = await callback();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/settings?signin=ok");
    const cookies = res.headers.getSetCookie();
    expect(cookies.filter((c) => /^(__Host-pp_at|__Secure-pp_rt|pp_signed_in)=/.test(c))).toHaveLength(3);
    expect(cookies.some((c) => /^__Host-pp_oauth=; Max-Age=0/.test(c))).toBe(true);
    expect(exchanged[0].get("code")).toBe("c1");
    expect(exchanged[0].get("code_verifier")).toBe(VERIFIER);
    const device = await env.DB.prepare("SELECT device_label AS l FROM refresh_tokens").first<{ l: string }>();
    expect(device?.l).toBe("Chrome on macOS");
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n).toBe(1);
  });

  it("callback rejects error=access_denied → cancelled", async () => {
    const { res } = await callback({ query: `error=access_denied&state=${STATE}` });
    expectRejected(res, "/settings?signin=cancelled");
  });

  it("callback rejects any other error → failed", async () => {
    const { res } = await callback({ query: `error=server_error&state=${STATE}` });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback rejects a missing code → failed", async () => {
    const { res } = await callback({ query: `state=${STATE}` });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback rejects missing state cookie → failed", async () => {
    const { res, exchanged } = await callback({ cookie: null });
    expectRejected(res, "/settings?signin=failed");
    expect(exchanged).toHaveLength(0);
  });

  it("callback rejects tampered state cookie → failed", async () => {
    const good = await signValue(env.HMAC_KEY, { p: "oauth", state: STATE, verifier: VERIFIER, nonce: NONCE }, NOW + 600_000);
    const tampered = `${good.slice(0, -1)}${good.endsWith("0") ? "1" : "0"}`;
    const { res } = await callback({ cookie: `${OAUTH}=${tampered}` });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback rejects expired state cookie → failed", async () => {
    const expired = await signValue(env.HMAC_KEY, { p: "oauth", state: STATE, verifier: VERIFIER, nonce: NONCE }, NOW - 1);
    const { res } = await callback({ cookie: `${OAUTH}=${expired}` });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback rejects state mismatch → failed", async () => {
    const { res, exchanged } = await callback({ query: "code=c1&state=other" });
    expectRejected(res, "/settings?signin=failed");
    expect(exchanged).toHaveLength(0);
  });

  it("callback rejects a mobile nonce value in the state cookie → failed", async () => {
    const mobile = await signValue(env.HMAC_KEY, { p: "nonce", n: "abc", state: STATE, verifier: VERIFIER, nonce: NONCE }, NOW + 600_000);
    const { res } = await callback({ cookie: `${OAUTH}=${mobile}` });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback rejects id token nonce mismatch → failed", async () => {
    const { res } = await callback({ idNonce: "wrong" });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback rejects a refused code exchange → failed", async () => {
    const { res } = await callback({ tokenStatus: 400 });
    expectRejected(res, "/settings?signin=failed");
  });

  it("callback treats upstream failures as failed, never a 500", async () => {
    for (const opts of [{ tokenStatus: 503 }, { throwOnFetch: true }, { jwksFails: true }]) {
      const { res } = await callback(opts);
      expectRejected(res, "/settings?signin=failed");
    }
  });

  it("callback treats a database failure as failed, never a 500", async () => {
    const real = env.DB.batch.bind(env.DB);
    env.DB.batch = (() => Promise.reject(new Error("d1 down"))) as typeof env.DB.batch;
    try {
      const { res } = await callback();
      expectRejected(res, "/settings?signin=failed");
    } finally {
      env.DB.batch = real;
    }
  });
});
