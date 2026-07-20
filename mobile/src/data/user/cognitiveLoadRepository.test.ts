import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  addDailyLoad,
  countDaysStudiedInMonth,
  getDailyLoad,
  getLastActiveDate,
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
  it('getLastActiveDate returns the most recent active day before the cutoff, or null', async () => {
    __mockResetSqlite();
    const db = await openDatabaseAsync('user.db');
    runMigrations(db as never, [migration008CognitiveLoadHistory]);

    expect(getLastActiveDate(db as never, '2026-07-21')).toBeNull();

    addDailyLoad(db as never, { date: '2026-07-10', increment: 12, threshold: 30 });
    addDailyLoad(db as never, { date: '2026-07-15', increment: 8, threshold: 30 });
    addDailyLoad(db as never, { date: '2026-07-20', increment: 5, threshold: 30 });

    expect(getLastActiveDate(db as never, '2026-07-20')).toBe('2026-07-15');
    expect(getLastActiveDate(db as never, '2026-07-21')).toBe('2026-07-20');
  });

  it('countDaysStudiedInMonth counts only active days inside the month, including December rollover', async () => {
    __mockResetSqlite();
    const db = await openDatabaseAsync('user.db');
    runMigrations(db as never, [migration008CognitiveLoadHistory]);

    expect(countDaysStudiedInMonth(db as never, 2026, 7)).toBe(0);

    addDailyLoad(db as never, { date: '2026-06-30', increment: 5, threshold: 30 });
    addDailyLoad(db as never, { date: '2026-07-01', increment: 5, threshold: 30 });
    addDailyLoad(db as never, { date: '2026-07-15', increment: 5, threshold: 30 });
    addDailyLoad(db as never, { date: '2026-07-31', increment: 5, threshold: 30 });
    addDailyLoad(db as never, { date: '2026-08-01', increment: 5, threshold: 30 });
    // A zero-load row is a rest day, not a study day.
    addDailyLoad(db as never, { date: '2026-07-20', increment: 0, threshold: 30 });

    expect(countDaysStudiedInMonth(db as never, 2026, 7)).toBe(3);

    addDailyLoad(db as never, { date: '2026-12-31', increment: 5, threshold: 30 });
    expect(countDaysStudiedInMonth(db as never, 2026, 12)).toBe(1);
  });

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
