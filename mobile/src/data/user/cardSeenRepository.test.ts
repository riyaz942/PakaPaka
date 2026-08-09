import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { migration019CardSeen } from '@/data/migrations/019_card_seen';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { isCardSeen, markCardSeen } from '@/data/user/cardSeenRepository';

async function createUserDb() {
  const db = await openDatabaseAsync('user.db');
  const result = runMigrations(db, [migration001Initial, migration019CardSeen]);
  expect(result.ok).toBe(true);
  return db;
}

describe('cardSeenRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('reports an unseen card as false', async () => {
    const db = await createUserDb();
    expect(isCardSeen(db, 'three-scripts')).toBe(false);
  });

  it('reports a card as seen once it is marked', async () => {
    const db = await createUserDb();
    markCardSeen(db, 'three-scripts');
    expect(isCardSeen(db, 'three-scripts')).toBe(true);
  });

  it('keeps the original seen_at when a card is marked twice', async () => {
    const db = await createUserDb();
    // Real clocks make this assertion vacuous: two calls in the same
    // millisecond produce the same timestamp whether or not the write updated.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-08T09:00:00.000Z'));
    markCardSeen(db, 'three-scripts');

    jest.setSystemTime(new Date('2026-08-09T09:00:00.000Z'));
    markCardSeen(db, 'three-scripts');

    expect(db.getAllSync('SELECT card_id FROM card_seen')).toHaveLength(1);
    expect(
      db.getFirstSync<{ seen_at: string }>(
        'SELECT seen_at FROM card_seen WHERE card_id = ?',
        'three-scripts',
      )?.seen_at,
    ).toBe('2026-08-08T09:00:00.000Z');
    jest.useRealTimers();
  });

  it('leaves other cards unseen', async () => {
    const db = await createUserDb();
    markCardSeen(db, 'three-scripts');
    expect(isCardSeen(db, 'word-spacing')).toBe(false);
  });
});
