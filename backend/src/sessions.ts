import { hmacHex, randomToken } from "./crypto";
import type { Env } from "./env";
import type { Result } from "./result";

const REFRESH_TTL_MS = 60 * 24 * 3600 * 1000;

export async function findOrCreateUser(db: D1Database, provider: "google", sub: string, nowMs: number): Promise<string> {
  const candidate = crypto.randomUUID();
  await db
    .prepare("INSERT INTO identities (provider, sub, user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(provider, sub) DO NOTHING")
    .bind(provider, sub, candidate, nowMs)
    .run();
  const row = await db
    .prepare("SELECT user_id FROM identities WHERE provider = ? AND sub = ?")
    .bind(provider, sub)
    .first<{ user_id: string }>();
  const userId = row?.user_id ?? candidate;
  // Only the request whose identity insert won creates the user row, so no orphans.
  if (userId === candidate) {
    await db.prepare("INSERT INTO users (user_id, created_at) VALUES (?, ?)").bind(userId, nowMs).run();
  }
  return userId;
}

export async function createDevice(
  env: Env,
  userId: string,
  label: string,
  nowMs: number,
): Promise<{ deviceId: string; refreshToken: string }> {
  const deviceId = crypto.randomUUID();
  const refreshToken = randomToken();
  await env.DB.prepare(
    "INSERT INTO refresh_tokens (token_hash, user_id, device_id, device_label, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(await hmacHex(env.HMAC_KEY, refreshToken), userId, deviceId, label, nowMs, nowMs)
    .run();
  return { deviceId, refreshToken };
}

export async function rotateRefreshToken(
  env: Env,
  token: string,
  nowMs: number,
): Promise<Result<{ userId: string; deviceId: string; refreshToken: string }, "unauthorized">> {
  const unauthorized = { ok: false, error: "unauthorized" } as const;
  const oldHash = await hmacHex(env.HMAC_KEY, token);
  const row = await env.DB.prepare(
    "SELECT user_id, device_id, device_label, created_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
  )
    .bind(oldHash)
    .first<{ user_id: string; device_id: string; device_label: string; created_at: number; revoked_at: number | null }>();
  if (!row) return unauthorized;

  const revokeDeviceRows = () =>
    env.DB.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL")
      .bind(nowMs, row.device_id)
      .run();

  if (row.revoked_at !== null) {
    await revokeDeviceRows();
    return unauthorized;
  }
  if (row.created_at + REFRESH_TTL_MS < nowMs) return unauthorized;

  const refreshToken = randomToken();
  const newHash = await hmacHex(env.HMAC_KEY, refreshToken);
  // The conditional UPDATE decides the race; the INSERT only runs if it changed a row.
  const [revoke] = await env.DB.batch([
    env.DB.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(nowMs, oldHash),
    env.DB.prepare(
      "INSERT INTO refresh_tokens (token_hash, user_id, device_id, device_label, created_at, last_used_at) SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1",
    ).bind(newHash, row.user_id, row.device_id, row.device_label, nowMs, nowMs),
  ]);
  if (revoke.meta.changes !== 1) {
    // Lost a race against another rotation of the same token: treat as reuse.
    await revokeDeviceRows();
    return unauthorized;
  }
  return { ok: true, value: { userId: row.user_id, deviceId: row.device_id, refreshToken } };
}

export async function revokeDevice(db: D1Database, userId: string, deviceId: string, nowMs: number): Promise<boolean> {
  const res = await db
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL")
    .bind(nowMs, userId, deviceId)
    .run();
  return res.meta.changes > 0;
}

export async function revokeAllDevices(db: D1Database, userId: string, nowMs: number): Promise<void> {
  await db
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .bind(nowMs, userId)
    .run();
}

export async function listDevices(
  db: D1Database,
  userId: string,
  nowMs: number = Date.now(),
): Promise<Array<{ deviceId: string; label: string; lastUsedAt: number }>> {
  const { results } = await db
    .prepare(
      "SELECT device_id, device_label, last_used_at FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL AND created_at + ? >= ? ORDER BY last_used_at DESC",
    )
    .bind(userId, REFRESH_TTL_MS, nowMs)
    .all<{ device_id: string; device_label: string; last_used_at: number }>();
  return results.map((r) => ({ deviceId: r.device_id, label: r.device_label, lastUsedAt: r.last_used_at }));
}

export async function deleteUserRows(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM sync_state WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM identities WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM users WHERE user_id = ?").bind(userId),
  ]);
}
