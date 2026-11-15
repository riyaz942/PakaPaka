import { serializeCookie } from "./http";

const AT = { name: "__Host-pp_at", path: "/", httpOnly: true, maxAge: 900 };
const RT = { name: "__Secure-pp_rt", path: "/api/auth", httpOnly: true, maxAge: 5_184_000 };
const SIGNED_IN = { name: "pp_signed_in", path: "/", httpOnly: false, maxAge: 5_184_000 };

export const AT_COOKIE = AT.name;
export const RT_COOKIE = RT.name;

export function setSessionCookies(headers: Headers, t: { accessToken: string; refreshToken: string }): void {
  headers.append("Set-Cookie", serializeCookie(AT.name, t.accessToken, AT));
  headers.append("Set-Cookie", serializeCookie(RT.name, t.refreshToken, RT));
  headers.append("Set-Cookie", serializeCookie(SIGNED_IN.name, "1", SIGNED_IN));
}

export function clearSessionCookies(headers: Headers): void {
  for (const c of [AT, RT, SIGNED_IN]) {
    headers.append("Set-Cookie", serializeCookie(c.name, "", { ...c, maxAge: 0 }));
  }
}
