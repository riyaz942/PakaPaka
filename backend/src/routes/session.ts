import { issueAccessToken } from "../accessToken";
import { authenticate, requireSameOrigin } from "../authenticate";
import type { Deps } from "../deps";
import type { Env } from "../env";
import { errorResponse, json, parseCookies } from "../http";
import { readLimitedText } from "../limits";
import { clearSessionCookies, RT_COOKIE, setSessionCookies } from "../sessionCookies";
import { revokeDevice, rotateRefreshToken } from "../sessions";

const MAX_BODY_BYTES = 8 * 1024;

export async function handleRefresh(req: Request, env: Env, deps: Deps): Promise<Response> {
  const text = await readLimitedText(req, MAX_BODY_BYTES);
  if (text === null) return errorResponse("payload_too_large", 413);

  let bodyToken: string | null = null;
  if (text.trim() !== "") {
    let body: { refreshToken?: unknown } | null;
    try {
      body = JSON.parse(text);
    } catch {
      return errorResponse("bad_payload", 400);
    }
    if (body === null || typeof body !== "object" || typeof body.refreshToken !== "string") {
      return errorResponse("bad_payload", 400);
    }
    bodyToken = body.refreshToken;
  }

  const viaCookie = bodyToken === null;
  if (viaCookie) {
    const badOrigin = requireSameOrigin(req, env, true);
    if (badOrigin) return badOrigin;
  }
  const token = bodyToken ?? parseCookies(req.headers.get("cookie"))[RT_COOKIE];

  const now = deps.now();
  const rotated = token ? await rotateRefreshToken(env, token, now) : null;
  if (!rotated || !rotated.ok) {
    const res = errorResponse("unauthorized", 401);
    if (viaCookie) clearSessionCookies(res.headers);
    return res;
  }
  const { userId, deviceId, refreshToken } = rotated.value;
  const accessToken = await issueAccessToken(env, userId, deviceId, now);
  if (!viaCookie) return json({ accessToken, refreshToken });
  const headers = new Headers();
  setSessionCookies(headers, { accessToken, refreshToken });
  return new Response(null, { status: 204, headers });
}

export async function handleSignout(req: Request, env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  const auth = await authenticate(req, env, now);
  if (!auth) return errorResponse("unauthorized", 401);
  const badOrigin = requireSameOrigin(req, env, auth.viaCookie);
  if (badOrigin) return badOrigin;
  await revokeDevice(env.DB, auth.userId, auth.deviceId, now);
  const headers = new Headers();
  if (auth.viaCookie) clearSessionCookies(headers);
  return new Response(null, { status: 204, headers });
}
