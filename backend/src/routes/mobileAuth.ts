import type { Deps } from "../deps";
import type { Env } from "../env";
import { randomToken, signValue, verifySignedValue } from "../crypto";
import { issueAccessToken } from "../accessToken";
import { googleAudiences, verifyGoogleIdToken } from "../google";
import { errorResponse, json } from "../http";
import { readLimitedText } from "../limits";
import { createDevice, findOrCreateUser } from "../sessions";

const NONCE_TTL_MS = 600_000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_LABEL_CHARS = 60;

export async function handleNonce(_req: Request, env: Env, deps: Deps): Promise<Response> {
  const nonce = await signValue(env.HMAC_KEY, { n: randomToken(16) }, deps.now() + NONCE_TTL_MS);
  return json({ nonce });
}

export async function handleExchange(req: Request, env: Env, deps: Deps): Promise<Response> {
  const text = await readLimitedText(req, MAX_BODY_BYTES);
  if (text === null) return errorResponse("payload_too_large", 413);
  let body: { provider?: unknown; idToken?: unknown; nonce?: unknown; deviceLabel?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse("invalid_token", 400);
  }
  if (
    body === null ||
    typeof body !== "object" ||
    body.provider !== "google" ||
    typeof body.idToken !== "string" ||
    typeof body.nonce !== "string" ||
    typeof body.deviceLabel !== "string"
  ) {
    return errorResponse("invalid_token", 400);
  }
  const { idToken, nonce } = body;
  const now = deps.now();

  const signed = await verifySignedValue<{ n?: unknown }>(env.HMAC_KEY, nonce, now);
  if (!signed || typeof signed.n !== "string") return errorResponse("invalid_nonce", 400);

  const verified = await verifyGoogleIdToken(idToken, {
    jwks: deps.googleJwks,
    audiences: googleAudiences(env),
    expectedNonce: nonce,
    nowMs: now,
  });
  if (!verified.ok) {
    return verified.error === "upstream_failed"
      ? errorResponse("server_error", 502)
      : errorResponse(verified.error, 401);
  }

  const userId = await findOrCreateUser(env.DB, "google", verified.value.sub, now);
  const label = body.deviceLabel.trim().slice(0, MAX_LABEL_CHARS) || "Phone";
  const { deviceId, refreshToken } = await createDevice(env, userId, label, now);
  const accessToken = await issueAccessToken(env, userId, deviceId, now);
  return json({ accessToken, refreshToken, deviceId, provider: "google" });
}
