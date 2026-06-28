import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { RELATED_ITEM_BOOST_CAP, RELATED_ITEM_BOOST_DELTA } from '@/config/constants';
import { migration006RelatedItemBoosts } from '@/data/migrations/006_related_item_boosts';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  applyBoosts,
  clearBoosts,
  getBoosts,
} from '@/data/user/relatedItemBoostRepository';

describe('relatedItemBoostRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration006RelatedItemBoosts]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('returns empty map when no boosts exist', async () => {
    const userDb = await createUserDb();
    expect(getBoosts(userDb, ['1', '2']).size).toBe(0);
  });

  it('applies, reads, and clears boosts in a round-trip', async () => {
    const userDb = await createUserDb();

    const applyResult = applyBoosts(userDb, [{ itemId: '1', delta: RELATED_ITEM_BOOST_DELTA }]);
    expect(applyResult.ok).toBe(true);

    expect(getBoosts(userDb, ['1']).get('1')).toBe(RELATED_ITEM_BOOST_DELTA);

    const clearResult = clearBoosts(userDb, ['1']);
    expect(clearResult.ok).toBe(true);
    expect(getBoosts(userDb, ['1']).size).toBe(0);
  });

  it('accumulates boosts and clamps to cap', async () => {
    const userDb = await createUserDb();

    for (let i = 0; i < 10; i += 1) {
      applyBoosts(userDb, [{ itemId: '2', delta: RELATED_ITEM_BOOST_DELTA }]);
    }

    expect(getBoosts(userDb, ['2']).get('2')).toBe(RELATED_ITEM_BOOST_CAP);
  });

  it('returns absent items as missing from the map', async () => {
    const userDb = await createUserDb();
    const boosts = getBoosts(userDb, ['99']);
    expect(boosts.has('99')).toBe(false);
  });
});
