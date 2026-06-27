import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration005PersonalMnemonics } from '@/data/migrations/005_personal_mnemonics';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  getPersonalMnemonic,
  setPersonalMnemonic,
} from '@/data/user/mnemonicRepository';

describe('mnemonicRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration005PersonalMnemonics]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('returns null when no personal mnemonic exists', async () => {
    const userDb = await createUserDb();
    expect(getPersonalMnemonic(userDb, '2')).toBeNull();
  });

  it('saves and reads back a personal mnemonic', async () => {
    const userDb = await createUserDb();

    setPersonalMnemonic(userDb, '2', 'My sun mnemonic');
    expect(getPersonalMnemonic(userDb, '2')).toBe('My sun mnemonic');
  });

  it('deletes the row when saving whitespace-only text', async () => {
    const userDb = await createUserDb();

    setPersonalMnemonic(userDb, '2', 'My mnemonic');
    setPersonalMnemonic(userDb, '2', '   ');

    expect(getPersonalMnemonic(userDb, '2')).toBeNull();
  });

  it('removes override when saving empty text after a prior save', async () => {
    const userDb = await createUserDb();

    setPersonalMnemonic(userDb, '3', 'Private self');
    setPersonalMnemonic(userDb, '3', '');

    expect(getPersonalMnemonic(userDb, '3')).toBeNull();
  });

  it('upserts idempotently and keeps a single row', async () => {
    const userDb = await createUserDb();

    setPersonalMnemonic(userDb, '4', 'First version');
    setPersonalMnemonic(userDb, '4', 'Second version');

    expect(getPersonalMnemonic(userDb, '4')).toBe('Second version');

    const rows = userDb.getAllSync<{ item_id: number }>(
      'SELECT item_id FROM personal_mnemonics WHERE item_id = ?',
      4,
    );
    expect(rows).toHaveLength(1);
  });

  it('trims leading and trailing whitespace on save', async () => {
    const userDb = await createUserDb();

    setPersonalMnemonic(userDb, '2', '  trimmed mnemonic  ');
    expect(getPersonalMnemonic(userDb, '2')).toBe('trimmed mnemonic');
  });
});
