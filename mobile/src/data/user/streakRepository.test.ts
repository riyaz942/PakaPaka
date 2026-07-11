import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration009Streak } from '@/data/migrations/009_streak';
import { migration014StreakCelebration } from '@/data/migrations/014_streak_celebration';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  claimStreakCelebration,
  getStreak,
  recordReviewAndUpdateStreak,
  yesterdayKey,
} from '@/data/user/streakRepository';

describe('streakRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [
      migration009Streak,
      migration014StreakCelebration,
    ]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('returns default streak when no row exists', async () => {
    const userDb = await createUserDb();
    expect(getStreak(userDb)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastReviewDate: null,
    });
  });

  it('sets streak to 1 on first review day', async () => {
    const userDb = await createUserDb();
    const result = recordReviewAndUpdateStreak(userDb, '2026-06-28');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        lastReviewDate: '2026-06-28',
        didIncrementToday: true,
      });
    }
    expect(getStreak(userDb)).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastReviewDate: '2026-06-28',
    });
  });

  it('is idempotent when called twice on the same day', async () => {
    const userDb = await createUserDb();

    recordReviewAndUpdateStreak(userDb, '2026-06-28');
    const second = recordReviewAndUpdateStreak(userDb, '2026-06-28');

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.currentStreak).toBe(1);
      expect(second.value.didIncrementToday).toBe(false);
    }
    expect(getStreak(userDb).currentStreak).toBe(1);
  });

  it('increments streak on consecutive days', async () => {
    const userDb = await createUserDb();

    recordReviewAndUpdateStreak(userDb, '2026-06-28');
    const result = recordReviewAndUpdateStreak(userDb, '2026-06-29');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        currentStreak: 2,
        longestStreak: 2,
        lastReviewDate: '2026-06-29',
        didIncrementToday: true,
      });
    }
  });

  it('resets streak to 1 after a missed day but keeps longest streak', async () => {
    const userDb = await createUserDb();

    recordReviewAndUpdateStreak(userDb, '2026-06-28');
    recordReviewAndUpdateStreak(userDb, '2026-06-29');
    const result = recordReviewAndUpdateStreak(userDb, '2026-07-01');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        currentStreak: 1,
        longestStreak: 2,
        lastReviewDate: '2026-07-01',
        didIncrementToday: true,
      });
    }
  });

  it('never decrements longest streak', async () => {
    const userDb = await createUserDb();

    recordReviewAndUpdateStreak(userDb, '2026-06-01');
    recordReviewAndUpdateStreak(userDb, '2026-06-02');
    recordReviewAndUpdateStreak(userDb, '2026-06-03');
    recordReviewAndUpdateStreak(userDb, '2026-06-10');

    expect(getStreak(userDb).longestStreak).toBe(3);
    expect(getStreak(userDb).currentStreak).toBe(1);
  });
});

describe('claimStreakCelebration', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [
      migration009Streak,
      migration014StreakCelebration,
    ]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('does not celebrate when no review happened today', async () => {
    const userDb = await createUserDb();

    expect(claimStreakCelebration(userDb, '2026-06-28')).toEqual({
      shouldCelebrate: false,
      currentStreak: 0,
    });
  });

  it('celebrates once after streak credit, then never again the same day', async () => {
    const userDb = await createUserDb();
    recordReviewAndUpdateStreak(userDb, '2026-06-28');

    expect(claimStreakCelebration(userDb, '2026-06-28')).toEqual({
      shouldCelebrate: true,
      currentStreak: 1,
    });
    expect(claimStreakCelebration(userDb, '2026-06-28').shouldCelebrate).toBe(false);
  });

  it('does not celebrate when credit was earned on a previous day', async () => {
    const userDb = await createUserDb();
    recordReviewAndUpdateStreak(userDb, '2026-06-28');

    expect(claimStreakCelebration(userDb, '2026-06-29').shouldCelebrate).toBe(false);
  });

  it('celebrates again on the next credited day', async () => {
    const userDb = await createUserDb();

    recordReviewAndUpdateStreak(userDb, '2026-06-28');
    claimStreakCelebration(userDb, '2026-06-28');

    recordReviewAndUpdateStreak(userDb, '2026-06-29');
    expect(claimStreakCelebration(userDb, '2026-06-29')).toEqual({
      shouldCelebrate: true,
      currentStreak: 2,
    });
  });
});

describe('yesterdayKey', () => {
  it('subtracts one day within the same month', () => {
    expect(yesterdayKey('2026-06-29')).toBe('2026-06-28');
  });

  it('handles month boundary', () => {
    expect(yesterdayKey('2026-06-01')).toBe('2026-05-31');
  });

  it('handles year boundary', () => {
    expect(yesterdayKey('2026-01-01')).toBe('2025-12-31');
  });
});
