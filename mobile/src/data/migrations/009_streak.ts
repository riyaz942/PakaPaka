import type { Migration } from '@/data/migrations/migrations.types';

export const migration009Streak: Migration = {
  version: 9,
  name: '009_streak',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS streaks (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_review_date TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
