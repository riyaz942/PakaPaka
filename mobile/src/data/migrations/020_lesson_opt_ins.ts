import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Items the learner asked to learn ahead of their level — 昨 (N3) from N5's
 * 昨日 (untaught-kanji plan, step 3). Per-learner and opt-in; it changes this
 * learner's lesson pool and nothing else, unlike the curriculum-level
 * pull-forward walk Plan v2 Phase C removed.
 *
 * Only the item the learner tapped is stored, never the radicals it drags
 * along. Which components a kanji needs is a fact about `curriculum.db`, and
 * that file is replaced wholesale by OTA update — writing the closure here
 * would freeze one version of the graph into `user.db`.
 */
export const migration020LessonOptIns: Migration = {
  version: 20,
  name: '020_lesson_opt_ins',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS lesson_opt_ins (
        item_id TEXT PRIMARY KEY,
        opted_in_at TEXT NOT NULL
      );
    `);
  },
};
