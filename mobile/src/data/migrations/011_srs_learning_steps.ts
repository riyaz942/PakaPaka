import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Persists the ts-fsrs learning-step index (Card.learning_steps). Without it,
 * cards in Learning/Relearning restart at step 0 on every review round-trip
 * and never graduate to Review state, so intervals never grow past the last
 * learning step. Existing rows default to 0 — exactly the step they were
 * being reset to before this migration, so no data repair is needed.
 */
export const migration011SrsLearningSteps: Migration = {
  version: 11,
  name: '011_srs_learning_steps',
  up: (db) => {
    db.execSync(`ALTER TABLE srs_states ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0;`);
  },
};
