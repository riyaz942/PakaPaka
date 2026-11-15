export type ErrorCode =
  | "unauthorized"
  | "bad_origin"
  | "rate_limited"
  | "turnstile_failed"
  | "invalid_token"
  | "invalid_nonce"
  | "not_found"
  | "payload_too_large"
  | "bad_payload"
  | "quota_exceeded"
  | "server_error";

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function errorResponse(code: ErrorCode, status: number): Response {
  return json({ error: code }, status);
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge: number; path: string; httpOnly: boolean },
): string {
  return (
    `${name}=${value}; Max-Age=${opts.maxAge}; Path=${opts.path}` +
    `${opts.httpOnly ? "; HttpOnly" : ""}; Secure; SameSite=Lax`
  );
}
