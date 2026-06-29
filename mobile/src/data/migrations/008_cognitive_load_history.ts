import type { Migration } from '@/data/migrations/migrations.types';

export const migration008CognitiveLoadHistory: Migration = {
  version: 8,
  name: '008_cognitive_load_history',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS cognitive_load_history (
        date TEXT PRIMARY KEY NOT NULL,
        load REAL NOT NULL DEFAULT 0,
        threshold REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
