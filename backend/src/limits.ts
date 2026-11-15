import { errorResponse } from "./http";

export async function rateLimit(limiter: RateLimit, key: string): Promise<Response | null> {
  const { success } = await limiter.limit({ key });
  return success ? null : errorResponse("rate_limited", 429);
}

// Reads a request body as text, or returns null when it is larger than maxBytes.
export async function readLimitedText(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const text = await req.text();
  return new TextEncoder().encode(text).length > maxBytes ? null : text;
}
