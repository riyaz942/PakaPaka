import type { Migration } from '@/data/migrations/migrations.types';

export const migration012UserSynonyms: Migration = {
  version: 12,
  name: '012_user_synonyms',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS user_synonyms (
        item_id INTEGER NOT NULL,
        answer_type TEXT NOT NULL CHECK(answer_type IN ('meaning','reading')),
        answer_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (item_id, answer_type, answer_text)
      );
    `);
  },
};
