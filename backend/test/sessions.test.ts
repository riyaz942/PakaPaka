import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createDevice,
  deleteUserRows,
  findOrCreateUser,
  listDevices,
  pruneRefreshTokens,
  revokeAllDevices,
  revokeDevice,
  rotateRefreshToken,
} from "../src/sessions";

const DAY = 24 * 3600 * 1000;
const NOW = 1_800_000_000_000;

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

beforeEach(async () => {
  await env.DB.batch(
    ["refresh_tokens", "sync_state", "identities", "users"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
  );
});

describe("findOrCreateUser", () => {
  it("same (provider, sub) returns the same user", async () => {
    const a = await findOrCreateUser(env.DB, "google", "sub-1", NOW);
    const b = await findOrCreateUser(env.DB, "google", "sub-1", NOW + 1);
    expect(b).toBe(a);
    expect(await count("users")).toBe(1);
  });

  it("different sub returns a new user", async () => {
    const a = await findOrCreateUser(env.DB, "google", "sub-1", NOW);
    const b = await findOrCreateUser(env.DB, "google", "sub-2", NOW);
    expect(b).not.toBe(a);
    expect(await count("users")).toBe(2);
  });

  it("concurrent first sign-in creates one user and no orphans", async () => {
    const ids = await Promise.all([
      findOrCreateUser(env.DB, "google", "sub-race", NOW),
      findOrCreateUser(env.DB, "google", "sub-race", NOW),
    ]);
    expect(ids[1]).toBe(ids[0]);
    expect(await count("users")).toBe(1);
    const orphans = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM identities WHERE user_id NOT IN (SELECT user_id FROM users)",
    ).first<{ n: number }>();
    expect(orphans?.n).toBe(0);
  });
});

describe("refresh rotation", () => {
  it("rotation returns a new token and the old one stops working", async () => {
    const { deviceId, refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    const r = await rotateRefreshToken(env, refreshToken, NOW + 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.userId).toBe("u1");
    expect(r.value.deviceId).toBe(deviceId);
    expect(r.value.refreshToken).not.toBe(refreshToken);
    const again = await rotateRefreshToken(env, refreshToken, NOW + 2000);
    expect(again).toEqual({ ok: false, error: "unauthorized" });
  });

  it("reusing a rotated token revokes the device", async () => {
    const { refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    const r = await rotateRefreshToken(env, refreshToken, NOW + 1000);
    if (!r.ok) throw new Error("rotation failed");
    expect(await rotateRefreshToken(env, refreshToken, NOW + 2000)).toEqual({ ok: false, error: "unauthorized" });
    expect(await rotateRefreshToken(env, r.value.refreshToken, NOW + 3000)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("concurrent rotation: only one succeeds", async () => {
    const { refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    const results = await Promise.all([
      rotateRefreshToken(env, refreshToken, NOW + 1000),
      rotateRefreshToken(env, refreshToken, NOW + 1000),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    const winner = results.find((r) => r.ok);
    if (!winner?.ok) throw new Error("no winner");
    // The loser triggered device revocation, so the winner's token is dead too.
    expect(await rotateRefreshToken(env, winner.value.refreshToken, NOW + 2000)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("a rotated token can itself be rotated once", async () => {
    const { refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    const first = await rotateRefreshToken(env, refreshToken, NOW + 1000);
    if (!first.ok) throw new Error("first rotation failed");
    const second = await rotateRefreshToken(env, first.value.refreshToken, NOW + 2000);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.deviceId).toBe(first.value.deviceId);
    expect(second.value.refreshToken).not.toBe(first.value.refreshToken);
  });

  it("token older than 60 days is unauthorized", async () => {
    const { refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    expect(await rotateRefreshToken(env, refreshToken, NOW + 60 * DAY + 1)).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("token exactly 60 days old still rotates", async () => {
    const { refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    expect((await rotateRefreshToken(env, refreshToken, NOW + 60 * DAY)).ok).toBe(true);
  });

  it("unknown token is unauthorized", async () => {
    expect(await rotateRefreshToken(env, "nope", NOW)).toEqual({ ok: false, error: "unauthorized" });
  });

  it("stored token_hash is not the raw token", async () => {
    const { refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    const row = await env.DB.prepare("SELECT token_hash FROM refresh_tokens").first<{ token_hash: string }>();
    expect(row?.token_hash).toBeTruthy();
    expect(row?.token_hash).not.toBe(refreshToken);
  });
});

describe("devices", () => {
  it("revokeDevice of another user's device returns false and changes nothing", async () => {
    const { deviceId, refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    expect(await revokeDevice(env.DB, "u2", deviceId, NOW + 1)).toBe(false);
    expect((await rotateRefreshToken(env, refreshToken, NOW + 2)).ok).toBe(true);
  });

  it("revokeDevice revokes own device", async () => {
    const { deviceId, refreshToken } = await createDevice(env, "u1", "Pixel", NOW);
    expect(await revokeDevice(env.DB, "u1", deviceId, NOW + 1)).toBe(true);
    expect((await rotateRefreshToken(env, refreshToken, NOW + 2)).ok).toBe(false);
  });

  it("revokeAllDevices revokes every device of the user only", async () => {
    const a = await createDevice(env, "u1", "A", NOW);
    const b = await createDevice(env, "u1", "B", NOW);
    const other = await createDevice(env, "u2", "C", NOW);
    await revokeAllDevices(env.DB, "u1", NOW + 1);
    expect((await rotateRefreshToken(env, a.refreshToken, NOW + 2)).ok).toBe(false);
    expect((await rotateRefreshToken(env, b.refreshToken, NOW + 2)).ok).toBe(false);
    expect((await rotateRefreshToken(env, other.refreshToken, NOW + 2)).ok).toBe(true);
  });

  it("listDevices hides revoked devices and orders by last use", async () => {
    const old = await createDevice(env, "u1", "Old", NOW);
    await createDevice(env, "u1", "Newer", NOW + 5000);
    const gone = await createDevice(env, "u1", "Gone", NOW + 9000);
    await revokeDevice(env.DB, "u1", gone.deviceId, NOW + 9500);
    await rotateRefreshToken(env, old.refreshToken, NOW + 20_000); // Old now has the newest last use
    const list = await listDevices(env.DB, "u1", NOW + 21_000);
    expect(list.map((d) => d.label)).toEqual(["Old", "Newer"]);
    expect(list[0]).toEqual({ deviceId: old.deviceId, label: "Old", lastUsedAt: NOW + 20_000 });
  });

  it("listDevices hides devices whose active token has expired", async () => {
    await createDevice(env, "u1", "Stale", NOW);
    await createDevice(env, "u1", "Fresh", NOW + 30 * DAY);
    const list = await listDevices(env.DB, "u1", NOW + 61 * DAY);
    expect(list.map((d) => d.label)).toEqual(["Fresh"]);
  });
});

describe("deleteUserRows", () => {
  async function seed(sub: string): Promise<string> {
    const userId = await findOrCreateUser(env.DB, "google", sub, NOW);
    await createDevice(env, userId, "Pixel", NOW);
    await env.DB.prepare("INSERT INTO sync_state (user_id, revision, updated_at) VALUES (?, 1, ?)")
      .bind(userId, NOW)
      .run();
    return userId;
  }

  it("removes rows in all four tables and leaves other users alone", async () => {
    const userId = await seed("sub-del");
    await seed("sub-keep");
    await deleteUserRows(env.DB, userId);
    for (const t of ["users", "identities", "sync_state", "refresh_tokens"]) {
      expect(await count(t)).toBe(1);
      const mine = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`)
        .bind(userId)
        .first<{ n: number }>();
      expect(mine?.n).toBe(0);
    }
  });
});

describe("pruneRefreshTokens", () => {
  async function row(label: string, createdAt: number, revokedAt: number | null) {
    await env.DB.prepare(
      "INSERT INTO refresh_tokens (token_hash, user_id, device_id, device_label, created_at, last_used_at, revoked_at) VALUES (?, 'u1', ?, ?, ?, ?, ?)",
    )
      .bind(`hash-${label}`, `dev-${label}`, label, createdAt, createdAt, revokedAt)
      .run();
  }
  const labels = async () =>
    (await env.DB.prepare("SELECT device_label AS l FROM refresh_tokens ORDER BY l").all<{ l: string }>()).results.map((r) => r.l);

  it("deletes rows revoked over 60 days ago and rows created over 120 days ago, keeps the rest", async () => {
    await row("revoked-61d", NOW - 100 * DAY, NOW - 61 * DAY);
    await row("revoked-59d", NOW - 100 * DAY, NOW - 59 * DAY);
    await row("old-121d", NOW - 121 * DAY, null);
    await row("old-119d", NOW - 119 * DAY, null);
    await row("active", NOW - 1 * DAY, null);
    await pruneRefreshTokens(env.DB, NOW);
    expect(await labels()).toEqual(["active", "old-119d", "revoked-59d"]);
  });

  it("does nothing on an empty table", async () => {
    await pruneRefreshTokens(env.DB, NOW);
    expect(await count("refresh_tokens")).toBe(0);
  });
});
