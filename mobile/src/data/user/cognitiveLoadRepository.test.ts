import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  addDailyLoad,
  getDailyLoad,
  getRecentDailyLoads,
  todayKey,
} from '@/data/user/cognitiveLoadRepository';

describe('cognitiveLoadRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration008CognitiveLoadHistory]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('returns null and empty recent loads when no history exists', async () => {
    const userDb = await createUserDb();
    expect(getDailyLoad(userDb, '2026-06-28')).toBeNull();
    expect(getRecentDailyLoads(userDb, '2026-06-28', 7)).toEqual([]);
  });

  it('accumulates load across calls on the same date', async () => {
    const userDb = await createUserDb();
    const date = '2026-06-28';

    expect(addDailyLoad(userDb, { date, increment: 3, threshold: 30 }).ok).toBe(true);
    expect(addDailyLoad(userDb, { date, increment: 2, threshold: 30 }).ok).toBe(true);

    const daily = getDailyLoad(userDb, date);
    expect(daily?.load).toBe(5);
    expect(daily?.threshold).toBe(30);
  });

  it('keeps distinct dates independent', async () => {
    const userDb = await createUserDb();

    addDailyLoad(userDb, { date: '2026-06-27', increment: 10, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-06-28', increment: 4, threshold: 30 });

    expect(getDailyLoad(userDb, '2026-06-27')?.load).toBe(10);
    expect(getDailyLoad(userDb, '2026-06-28')?.load).toBe(4);
  });

  it('returns recent loads before a given date', async () => {
    const userDb = await createUserDb();

    addDailyLoad(userDb, { date: '2026-06-25', increment: 20, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-06-26', increment: 25, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-06-28', increment: 5, threshold: 30 });

    expect(getRecentDailyLoads(userDb, '2026-06-28', 7)).toEqual([25, 20]);
  });
});

describe('todayKey', () => {
  it('returns local YYYY-MM-DD', () => {
    const key = todayKey(new Date(2026, 5, 28, 23, 30));
    expect(key).toBe('2026-06-28');
  });

  it('formats using local date parts not UTC slice', () => {
    const date = new Date(2026, 0, 15, 12, 0);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(todayKey(date)).toBe(expected);
    expect(todayKey(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
