import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Progress sync's base copy: the last file this device synced, its server revision, the keys of
 * base rows `user.db` does not hold (`carried_keys_json`, NULL = none), the last sync time and the
 * last error. One row; `data_json IS NULL` means "no base". Device-only: never in `BackupData`.
 */
export const migration022SyncBase: Migration = {
  version: 22,
  name: '022_sync_base',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS sync_base (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL DEFAULT 0,
        data_json TEXT,
        carried_keys_json TEXT,
        pending_replace INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT,
        last_error_code TEXT
      );
    `);
  },
};
