import { authenticate, requireSameOrigin } from "../authenticate";
import type { Deps } from "../deps";
import type { Env } from "../env";
import { errorResponse, json, type ErrorCode } from "../http";
import { checkUploadBody, uploadRateLimit } from "../limits";
import { checkSyncEnvelope } from "../syncEnvelope";

// Files kept beside the current one, for recovery by hand.
const KEEP_PREVIOUS = 3;

function nonNegativeInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function syncRow(db: D1Database, userId: string) {
  return db
    .prepare("SELECT revision, object_key FROM sync_state WHERE user_id = ?")
    .bind(userId)
    .first<{ revision: number; object_key: string | null }>();
}

async function userExists(db: D1Database, userId: string): Promise<boolean> {
  return (await db.prepare("SELECT 1 FROM users WHERE user_id = ?").bind(userId).first()) !== null;
}

function conflict(revision: number): Response {
  return json({ error: "revision_conflict" satisfies ErrorCode, revision }, 409);
}

const revisionOf = (prefix: string, key: string) => Number(key.slice(prefix.length, prefix.length + 10));

export async function handleGetSync(req: Request, env: Env, deps: Deps): Promise<Response> {
  const auth = await authenticate(req, env, deps.now());
  if (!auth) return errorResponse("unauthorized", 401);
  const have = nonNegativeInt(new URL(req.url).searchParams.get("have"));
  if (have === null) return errorResponse("bad_payload", 400);

  const row = await syncRow(env.DB, auth.userId);
  const revision = row?.revision ?? 0;
  if (!row || revision === have) {
    return new Response(null, { status: 204, headers: { "X-Sync-Revision": String(revision) } });
  }
  const object = row.object_key === null ? null : await env.PROGRESS.get(row.object_key);
  if (!object) return errorResponse("server_error", 500);
  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": "application/gzip",
      "X-Sync-Revision": String(revision),
      "Cache-Control": "no-store",
    },
  });
}

export async function handlePutSync(req: Request, env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  const auth = await authenticate(req, env, now);
  if (!auth) return errorResponse("unauthorized", 401);
  const badOrigin = requireSameOrigin(req, env, auth.viaCookie);
  if (badOrigin) return badOrigin;
  const base = nonNegativeInt(new URL(req.url).searchParams.get("base_revision"));
  if (base === null) return errorResponse("bad_payload", 400);
  const limited = await uploadRateLimit(env, auth.userId);
  if (limited) return limited;
  const body = await checkUploadBody(req);
  if (!body.ok) return errorResponse(body.error, body.error === "payload_too_large" ? 413 : 400);
  if (!(await checkSyncEnvelope(body.value))) return errorResponse("bad_payload", 400);

  // A deleted account keeps a live access token for up to 15 minutes.
  if (!(await userExists(env.DB, auth.userId))) return errorResponse("unauthorized", 401);
  const current = (await syncRow(env.DB, auth.userId))?.revision ?? 0;
  if (current !== base) return conflict(current);

  // A unique key per upload: two racing PUTs never overwrite each other's bytes.
  const newRev = base + 1;
  const prefix = `progress/${auth.userId}/`;
  const key = `${prefix}${String(newRev).padStart(10, "0")}-${crypto.randomUUID()}.json.gz`;
  await env.PROGRESS.put(key, body.value);

  const swap =
    base === 0
      ? env.DB.prepare(
          "INSERT INTO sync_state (user_id, revision, updated_at, last_device_id, object_key) SELECT ?, 1, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE user_id = ?) ON CONFLICT(user_id) DO NOTHING",
        ).bind(auth.userId, now, auth.deviceId, key, auth.userId)
      : env.DB.prepare(
          "UPDATE sync_state SET revision = ?, updated_at = ?, last_device_id = ?, object_key = ? WHERE user_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM users WHERE user_id = ?)",
        ).bind(newRev, now, auth.deviceId, key, auth.userId, base, auth.userId);
  // No R2 delete if run() throws: the D1 write may have committed, and the key would then be the current file.
  const { meta } = await swap.run();
  if (meta.changes !== 1) {
    await env.PROGRESS.delete(key);
    if (!(await userExists(env.DB, auth.userId))) return errorResponse("unauthorized", 401);
    return conflict((await syncRow(env.DB, auth.userId))?.revision ?? 0);
  }

  try {
    const { objects } = await env.PROGRESS.list({ prefix });
    const old = objects.map((o) => o.key).filter((k) => revisionOf(prefix, k) < newRev - KEEP_PREVIOUS);
    if (old.length > 0) await env.PROGRESS.delete(old);
  } catch (err) {
    console.warn(`sync prune failed: ${(err as { name?: unknown } | null)?.name ?? "unknown"}`);
  }
  return json({ revision: newRev });
}
