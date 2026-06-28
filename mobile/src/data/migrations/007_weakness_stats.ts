import type { Migration } from '@/data/migrations/migrations.types';

export const migration007WeaknessStats: Migration = {
  version: 7,
  name: '007_weakness_stats',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS weakness_stats (
        item_id INTEGER PRIMARY KEY NOT NULL,
        correct_count INTEGER NOT NULL DEFAULT 0,
        incorrect_count INTEGER NOT NULL DEFAULT 0,
        typo_count INTEGER NOT NULL DEFAULT 0,
        last_error_at TEXT,
        last_error_type TEXT,
        pattern_tags TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
