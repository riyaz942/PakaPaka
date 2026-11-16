import type { Env } from "./env";
import { errorResponse } from "./http";
import type { Result } from "./result";

export async function rateLimit(limiter: RateLimit, key: string): Promise<Response | null> {
  const { success } = await limiter.limit({ key });
  return success ? null : errorResponse("rate_limited", 429);
}

// Reads a request body, or returns null when it is larger than maxBytes.
// Streams the body and cancels it as soon as the cap is passed.
export async function readLimitedBytes(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return all;
}

export async function readLimitedText(req: Request, maxBytes: number): Promise<string | null> {
  const bytes = await readLimitedBytes(req, maxBytes);
  return bytes === null ? null : new TextDecoder().decode(bytes);
}

export const MAX_UPLOAD_BYTES = 2_000_000;

// Size and gzip-magic guard for a progress upload. The envelope (format/version) check belongs to Part 3.
export async function checkUploadBody(
  req: Request,
  maxBytes = MAX_UPLOAD_BYTES,
): Promise<Result<Uint8Array, "payload_too_large" | "bad_payload">> {
  const bytes = await readLimitedBytes(req, maxBytes);
  if (bytes === null) return { ok: false, error: "payload_too_large" };
  if (bytes.byteLength < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return { ok: false, error: "bad_payload" };
  return { ok: true, value: bytes };
}

export function uploadRateLimit(env: Pick<Env, "UPLOAD_LIMITER">, userId: string): Promise<Response | null> {
  return rateLimit(env.UPLOAD_LIMITER, userId);
}

// Free-plan and storage limit errors, as worded in the Cloudflare D1 error list.
// Source: https://developers.cloudflare.com/d1/observability/debug-d1/#error-list (checked 2026-11-15).
// R2 documents no exact limit-error text, so no R2 pattern is matched.
const QUOTA_ERROR_PATTERNS = [
  /exceeded D1's free tier daily row read limit/i,
  /exceeded D1's free tier daily row write limit/i,
  /exceeded D1's maximum account storage limit/i,
  /Exceeded maximum DB size/i,
];

// Maps an unexpected error to a response. Never puts the message in the body or the log:
// it can contain SQL with bound values.
export function toServerErrorResponse(err: unknown): Response {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  const name = typeof e?.name === "string" ? e.name : "unknown";
  const code = typeof e?.code === "string" || typeof e?.code === "number" ? ` code=${e.code}` : "";
  console.error(`server error: ${name}${code}`);
  // The D1 detail can sit in the message or one level down in the cause.
  const cause = (err as { cause?: { message?: unknown } | null } | null)?.cause;
  const texts = [e?.message, cause?.message].filter((t): t is string => typeof t === "string");
  if (texts.some((t) => QUOTA_ERROR_PATTERNS.some((p) => p.test(t)))) return errorResponse("quota_exceeded", 503);
  return errorResponse("server_error", 500);
}
