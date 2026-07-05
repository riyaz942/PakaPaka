import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Adds an explicit last_reviewed_at column so FSRS elapsed-day math no longer
 * derives from updated_at, which is also stamped by non-review writes (imports).
 * NULL for rows that have never been graded in-app.
 */
export const migration010SrsLastReviewedAt: Migration = {
  version: 10,
  name: '010_srs_last_reviewed_at',
  up: (db) => {
    db.execSync(`ALTER TABLE srs_states ADD COLUMN last_reviewed_at TEXT;`);
  },
};
