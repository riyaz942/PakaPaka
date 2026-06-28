import type { Migration } from '@/data/migrations/migrations.types';

export const migration006RelatedItemBoosts: Migration = {
  version: 6,
  name: '006_related_item_boosts',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS related_item_boosts (
        item_id INTEGER PRIMARY KEY NOT NULL,
        boost REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
