import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Persistent per-word furigana overrides (FR79, UX-DR19/33).
 *
 * One row per curriculum vocabulary `item_id` — deliberately its own table
 * rather than a `user_preferences` key, which is one-row-per-key. An override
 * is always a definite choice, never 'auto': 'auto' is what you get by having
 * no row at all, at which point the SRS default and the global mode decide.
 *
 * Note: the planning docs call this migration `015`; that id was taken by
 * `015_goal_ring_state` before this story shipped, hence `016`.
 */
export const migration016FuriganaOverrides: Migration = {
  version: 16,
  name: '016_furigana_overrides',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS furigana_overrides (
        item_id TEXT PRIMARY KEY,
        display_mode TEXT NOT NULL CHECK (display_mode IN ('shown', 'hidden')),
        updated_at TEXT NOT NULL
      );
    `);
  },
};
