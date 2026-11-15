import type { Deps } from "../deps";
import type { Env } from "../env";
import { issueAccessToken } from "../accessToken";
import { randomToken, sha256Base64Url, signValue, verifySignedValue } from "../crypto";
import { deviceLabelFromUserAgent } from "../deviceLabel";
import { buildGoogleAuthUrl, exchangeGoogleCode, googleAudiences, verifyGoogleIdToken } from "../google";
import { errorResponse, parseCookies, serializeCookie } from "../http";
import { readLimitedText } from "../limits";
import { createDevice, findOrCreateUser } from "../sessions";
import { setSessionCookies } from "../sessionCookies";
import { SIGNIN_HEADERS, SIGNIN_SCRIPT, signinPage } from "../signinPage";

const OAUTH_COOKIE = "__Host-pp_oauth";
const OAUTH_TTL_S = 600;
const MAX_BODY_BYTES = 8 * 1024;

const oauthCookie = { path: "/", httpOnly: true };

function redirect(status: 302 | 303, location: string, setCookie?: string): Response {
  const headers = new Headers({ location });
  if (setCookie) headers.append("set-cookie", setCookie);
  return new Response(null, { status, headers });
}

export function handleSigninPage(req: Request, env: Env): Response {
  const error = new URL(req.url).searchParams.get("error");
  return new Response(signinPage(env.TURNSTILE_SITE_KEY, error), { headers: SIGNIN_HEADERS });
}

export function handleSigninScript(): Response {
  return new Response(SIGNIN_SCRIPT, {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

async function turnstilePassed(req: Request, env: Env, deps: Deps, token: string): Promise<boolean> {
  try {
    const res = await deps.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: req.headers.get("cf-connecting-ip") ?? "",
      }).toString(),
    });
    return res.ok && ((await res.json()) as { success?: unknown }).success === true;
  } catch {
    return false;
  }
}

export async function handleWebStart(req: Request, env: Env, deps: Deps): Promise<Response> {
  // Login-CSRF guard: only our own page may start a sign-in.
  if (req.headers.get("origin") !== env.APP_ORIGIN) return redirect(303, "/auth/signin?error=origin");
  const text = await readLimitedText(req, MAX_BODY_BYTES);
  if (text === null) return errorResponse("payload_too_large", 413);
  const token = new URLSearchParams(text).get("cf-turnstile-response");
  if (!token || !(await turnstilePassed(req, env, deps, token))) return redirect(303, "/auth/signin?error=turnstile");

  const verifier = randomToken(32);
  const state = randomToken(16);
  const nonce = randomToken(16);
  const cookie = await signValue(env.HMAC_KEY, { p: "oauth", state, verifier, nonce }, deps.now() + OAUTH_TTL_S * 1000);
  return redirect(
    303,
    buildGoogleAuthUrl(env, { state, nonce, codeChallenge: await sha256Base64Url(verifier) }),
    serializeCookie(OAUTH_COOKIE, cookie, { ...oauthCookie, maxAge: OAUTH_TTL_S }),
  );
}

type OauthPayload = { p?: unknown; state?: unknown; verifier?: unknown; nonce?: unknown };

export async function handleGoogleCallback(req: Request, env: Env, deps: Deps): Promise<Response> {
  const clear = serializeCookie(OAUTH_COOKIE, "", { ...oauthCookie, maxAge: 0 });
  const failed = redirect(302, "/settings?signin=failed", clear);
  try {
    const params = new URL(req.url).searchParams;
    const error = params.get("error");
    if (error === "access_denied") return redirect(302, "/settings?signin=cancelled", clear);
    const code = params.get("code");
    const state = params.get("state");
    if (error || !code || !state) return failed;

    const raw = parseCookies(req.headers.get("cookie"))[OAUTH_COOKIE];
    const saved = raw ? await verifySignedValue<OauthPayload>(env.HMAC_KEY, raw, deps.now()) : null;
    if (
      !saved ||
      saved.p !== "oauth" ||
      typeof saved.state !== "string" ||
      typeof saved.verifier !== "string" ||
      typeof saved.nonce !== "string" ||
      saved.state !== state
    ) {
      return failed;
    }

    const idToken = await exchangeGoogleCode(env, deps, { code, codeVerifier: saved.verifier });
    if (!idToken.ok) return failed;
    const verified = await verifyGoogleIdToken(idToken.value, {
      jwks: deps.googleJwks,
      audiences: googleAudiences(env),
      expectedNonce: saved.nonce,
      nowMs: deps.now(),
    });
    if (!verified.ok) return failed;

    const now = deps.now();
    const userId = await findOrCreateUser(env.DB, "google", verified.value.sub, now);
    const label = deviceLabelFromUserAgent(req.headers.get("user-agent"));
    const { deviceId, refreshToken } = await createDevice(env, userId, label, now);
    const accessToken = await issueAccessToken(env, userId, deviceId, now);
    const res = redirect(302, "/settings?signin=ok", clear);
    setSessionCookies(res.headers, { accessToken, refreshToken });
    return res;
  } catch {
    // Never include the error: it could carry request data.
    return failed;
  }
}
