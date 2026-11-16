import { verifyAccessToken } from "./accessToken";
import type { Env } from "./env";
import { errorResponse, parseCookies } from "./http";
import { AT_COOKIE } from "./sessionCookies";

export type Auth = { userId: string; deviceId: string; viaCookie: boolean };

// Signature and exp only; no D1 read. A removed device keeps access until its access token expires (<= 15 min).
export async function authenticate(req: Request, env: Env, nowMs: number): Promise<Auth | null> {
  const header = req.headers.get("authorization");
  if (header !== null) {
    const m = /^Bearer (\S+)$/.exec(header);
    if (!m) return null;
    const claims = await verifyAccessToken(env, m[1], nowMs);
    return claims && { ...claims, viaCookie: false };
  }
  const cookie = parseCookies(req.headers.get("cookie"))[AT_COOKIE];
  if (!cookie) return null;
  const claims = await verifyAccessToken(env, cookie, nowMs);
  return claims && { ...claims, viaCookie: true };
}

// Only cookie-authenticated requests need this: a bearer token is not sent by the browser on its own.
export function requireSameOrigin(req: Request, env: Env, viaCookie: boolean): Response | null {
  if (!viaCookie || req.method === "GET" || req.method === "HEAD") return null;
  return req.headers.get("origin") === env.APP_ORIGIN ? null : errorResponse("bad_origin", 403);
}
