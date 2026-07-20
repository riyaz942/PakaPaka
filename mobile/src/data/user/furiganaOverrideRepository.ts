import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyFuriganaOverridesChanged } from '@/data/user/furiganaOverrideEvents';

/**
 * A persistent per-word furigana choice (FR79). Deliberately narrower than
 * `FuriganaDisplayMode`: an override is always definite, and 'auto' is
 * expressed by having no row at all.
 */
export type FuriganaOverrideMode = 'shown' | 'hidden';

/** One override, joined against curriculum for a human-readable label. */
export type FuriganaOverrideEntry = {
  itemId: string;
  primaryForm: string;
  mode: FuriganaOverrideMode;
};

const OVERRIDE_MODES: FuriganaOverrideMode[] = ['shown', 'hidden'];

export function getFuriganaOverride(
  userDb: SQLiteDatabase,
  itemId: string,
): FuriganaOverrideMode | null {
  const row = userDb.getFirstSync<{ display_mode: FuriganaOverrideMode }>(
    'SELECT display_mode FROM furigana_overrides WHERE item_id = ?',
    itemId,
  );

  return row?.display_mode ?? null;
}

export function setFuriganaOverride(
  userDb: SQLiteDatabase,
  itemId: string,
  mode: FuriganaOverrideMode,
): void {
  if (!OVERRIDE_MODES.includes(mode)) {
    throw new Error(`Invalid furigana override mode: ${mode}`);
  }

  userDb.runSync(
    `INSERT INTO furigana_overrides (item_id, display_mode, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       display_mode = excluded.display_mode,
       updated_at = excluded.updated_at`,
    itemId,
    mode,
    new Date().toISOString(),
  );
  notifyFuriganaOverridesChanged();
}

export function clearFuriganaOverride(userDb: SQLiteDatabase, itemId: string): void {
  userDb.runSync('DELETE FROM furigana_overrides WHERE item_id = ?', itemId);
  notifyFuriganaOverridesChanged();
}

/** Settings "reset overrides" (AC #3) — drops every per-word choice at once. */
export function clearAllFuriganaOverrides(userDb: SQLiteDatabase): void {
  userDb.runSync('DELETE FROM furigana_overrides');
  notifyFuriganaOverridesChanged();
}

/**
 * Overrides with their word labels, for the Settings list. Left-joins the
 * `curriculum` alias attached by `attachCurriculumForQuery` (see database.ts)
 * so rows whose item was removed by a curriculum OTA still appear and can be
 * reset (INNER JOIN would hide them while `getAllFuriganaOverrides` kept applying them).
 */
export function listFuriganaOverrides(userDb: SQLiteDatabase): FuriganaOverrideEntry[] {
  const rows = userDb.getAllSync<{
    item_id: string;
    primary_form: string | null;
    display_mode: FuriganaOverrideMode;
  }>(
    `SELECT o.item_id, i.primary_form, o.display_mode
     FROM furigana_overrides o
     LEFT JOIN curriculum.items i ON i.id = o.item_id
     ORDER BY o.updated_at DESC`,
  );

  return rows.map((row) => ({
    itemId: row.item_id,
    primaryForm: row.primary_form ?? '(removed)',
    mode: row.display_mode,
  }));
}

/**
 * Every override as a lookup map. Read once per furigana surface mount, so it
 * stays in `user.db` with no curriculum join — labels are only needed by
 * Settings (`listFuriganaOverrides`).
 */
export function getAllFuriganaOverrides(
  userDb: SQLiteDatabase,
): ReadonlyMap<string, FuriganaOverrideMode> {
  const rows = userDb.getAllSync<{ item_id: string; display_mode: FuriganaOverrideMode }>(
    'SELECT item_id, display_mode FROM furigana_overrides',
  );

  return new Map(rows.map((row) => [row.item_id, row.display_mode]));
}
