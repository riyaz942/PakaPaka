import type { Migration } from '@/data/migrations/migrations.types';

export const migration002ItemStudyStatus: Migration = {
  version: 2,
  name: '002_item_study_status',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS item_study_status (
        item_id INTEGER PRIMARY KEY NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('known', 'in_progress', 'not_started')),
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_item_study_status_status ON item_study_status(status);
    `);
  },
};
