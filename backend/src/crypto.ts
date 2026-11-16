const enc = new TextEncoder();
const dec = new TextDecoder();
// HMAC_KEY also hashes refresh tokens; the prefix keeps signed-value MACs distinct from those.
const SIGNED_VALUE_DOMAIN = "signed-value:";

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hmacHex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Base64Url(data: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(data))));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signValue(key: string, payload: object, expiresAtMs: number): Promise<string> {
  const body = toBase64Url(enc.encode(JSON.stringify({ d: payload, exp: expiresAtMs })));
  return `${body}.${await hmacHex(key, SIGNED_VALUE_DOMAIN + body)}`;
}

export async function verifySignedValue<T>(key: string, value: string, nowMs: number): Promise<T | null> {
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  if (!timingSafeEqual(value.slice(dot + 1), await hmacHex(key, SIGNED_VALUE_DOMAIN + body))) return null;
  try {
    const parsed = JSON.parse(dec.decode(fromBase64Url(body))) as { d?: unknown; exp?: unknown };
    if (typeof parsed.exp !== "number" || nowMs > parsed.exp) return null;
    return parsed.d as T;
  } catch {
    return null;
  }
}
