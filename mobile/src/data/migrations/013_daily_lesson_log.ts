import type { Migration } from '@/data/migrations/migrations.types';

export const migration013DailyLessonLog: Migration = {
  version: 13,
  name: '013_daily_lesson_log',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS daily_lesson_log (
        date TEXT PRIMARY KEY,
        items_started INTEGER NOT NULL DEFAULT 0
      );
    `);
  },
};
