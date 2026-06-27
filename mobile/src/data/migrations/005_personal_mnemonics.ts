import type { Migration } from '@/data/migrations/migrations.types';

export const migration005PersonalMnemonics: Migration = {
  version: 5,
  name: '005_personal_mnemonics',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS personal_mnemonics (
        item_id INTEGER PRIMARY KEY NOT NULL,
        mnemonic_text TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
