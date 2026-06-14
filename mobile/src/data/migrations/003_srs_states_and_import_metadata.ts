import type { Migration } from '@/data/migrations/migrations.types';

export const migration003SrsStatesAndImportMetadata: Migration = {
  version: 3,
  name: '003_srs_states_and_import_metadata',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS srs_states (
        item_id INTEGER PRIMARY KEY NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        due_date TEXT NOT NULL,
        fsrs_state TEXT NOT NULL CHECK(fsrs_state IN ('new', 'learning', 'review', 'relearning')),
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        is_burned INTEGER NOT NULL DEFAULT 0 CHECK(is_burned IN (0, 1)),
        srs_stage_label TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_srs_states_due_date ON srs_states(due_date);
      CREATE INDEX IF NOT EXISTS idx_srs_states_is_burned ON srs_states(is_burned);

      CREATE TABLE IF NOT EXISTS import_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL CHECK(source IN ('wanikani', 'bunpro', 'anki')),
        imported_at TEXT NOT NULL,
        mapped_count INTEGER NOT NULL,
        unmatched_count INTEGER NOT NULL
      );
    `);
  },
};
