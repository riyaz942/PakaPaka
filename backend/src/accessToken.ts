import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./env";

const ACCESS_TOKEN_SECONDS = 900;
const enc = new TextEncoder();

export async function issueAccessToken(env: Env, userId: string, deviceId: string, nowMs: number): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ did: deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TOKEN_SECONDS)
    .sign(enc.encode(env.SESSION_SIGNING_KEY));
}

export async function verifyAccessToken(
  env: Env,
  token: string,
  nowMs: number,
): Promise<{ userId: string; deviceId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(env.SESSION_SIGNING_KEY), {
      algorithms: ["HS256"],
      requiredClaims: ["exp", "iat", "sub", "did"],
      currentDate: new Date(nowMs),
    });
    if (typeof payload.sub !== "string" || typeof payload.did !== "string") return null;
    return { userId: payload.sub, deviceId: payload.did };
  } catch {
    return null;
  }
}
