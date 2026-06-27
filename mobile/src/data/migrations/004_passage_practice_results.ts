import type { Migration } from '@/data/migrations/migrations.types';

export const migration004PassagePracticeResults: Migration = {
  version: 4,
  name: '004_passage_practice_results',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS passage_practice_results (
        passage_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
        user_answer TEXT NOT NULL,
        answered_at TEXT NOT NULL,
        PRIMARY KEY (passage_id, question_id)
      );
    `);
  },
};
