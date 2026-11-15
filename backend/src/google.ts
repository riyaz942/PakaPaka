import { jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Deps } from "./deps";
import type { Env } from "./env";
import type { Result } from "./result";

const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export function googleAudiences(env: Env): string[] {
  const ios = env.GOOGLE_IOS_CLIENT_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [env.GOOGLE_WEB_CLIENT_ID, ...ios];
}

export async function verifyGoogleIdToken(
  idToken: string,
  opts: { jwks: JWTVerifyGetKey; audiences: string[]; expectedNonce: string; nowMs: number },
): Promise<Result<{ sub: string }, "invalid_token" | "invalid_nonce">> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, opts.jwks, {
      algorithms: ["RS256"],
      issuer: ISSUERS,
      audience: opts.audiences,
      clockTolerance: 30,
      currentDate: new Date(opts.nowMs),
    }));
  } catch {
    return { ok: false, error: "invalid_token" };
  }
  if (typeof payload.sub !== "string" || payload.sub === "") return { ok: false, error: "invalid_token" };
  if (payload.nonce !== opts.expectedNonce) return { ok: false, error: "invalid_nonce" };
  return { ok: true, value: { sub: payload.sub } };
}

function redirectUri(env: Env): string {
  return `${env.APP_ORIGIN}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(
  env: Env,
  p: { state: string; nonce: string; codeChallenge: string },
): string {
  const q = new URLSearchParams({
    client_id: env.GOOGLE_WEB_CLIENT_ID,
    redirect_uri: redirectUri(env),
    response_type: "code",
    scope: "openid",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeGoogleCode(
  env: Env,
  deps: Deps,
  p: { code: string; codeVerifier: string },
): Promise<Result<string, "invalid_token">> {
  try {
    const res = await deps.fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: p.code,
        code_verifier: p.codeVerifier,
        client_id: env.GOOGLE_WEB_CLIENT_ID,
        client_secret: env.GOOGLE_WEB_CLIENT_SECRET,
        redirect_uri: redirectUri(env),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok) return { ok: false, error: "invalid_token" };
    const body = (await res.json()) as { id_token?: unknown };
    if (typeof body.id_token !== "string" || body.id_token === "") return { ok: false, error: "invalid_token" };
    return { ok: true, value: body.id_token };
  } catch {
    return { ok: false, error: "invalid_token" };
  }
}
