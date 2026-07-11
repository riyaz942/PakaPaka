import type { Migration } from '@/data/migrations/migrations.types';

export const migration014StreakCelebration: Migration = {
  version: 14,
  name: '014_streak_celebration',
  up: (db) => {
    db.execSync(`
      ALTER TABLE streaks ADD COLUMN last_celebrated_date TEXT;
    `);
  },
};
