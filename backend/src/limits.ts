import { errorResponse } from "./http";

export async function rateLimit(limiter: RateLimit, key: string): Promise<Response | null> {
  const { success } = await limiter.limit({ key });
  return success ? null : errorResponse("rate_limited", 429);
}

// Reads a request body as text, or returns null when it is larger than maxBytes.
// Streams the body and cancels it as soon as the cap is passed.
export async function readLimitedText(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";
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
  return new TextDecoder().decode(all);
}
