import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError, Result } from '@/types/result.types';

type StreakRow = {
  id: number;
  current_streak: number;
  longest_streak: number;
  last_review_date: string | null;
  updated_at: string;
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
};

/** Result of recording a review day: streak data plus whether this call credited today. */
export type StreakUpdate = StreakData & {
  didIncrementToday: boolean;
};

export type StreakState = 'active' | 'at-risk' | 'broken';

export function yesterdayKey(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const d = new Date(year, month - 1, day - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rowToStreakData(row: StreakRow | null): StreakData {
  if (!row) {
    return { currentStreak: 0, longestStreak: 0, lastReviewDate: null };
  }
  return {
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastReviewDate: row.last_review_date,
  };
}

export function getStreak(userDb: SQLiteDatabase): StreakData {
  const row = userDb.getFirstSync<StreakRow>(
    'SELECT id, current_streak, longest_streak, last_review_date, updated_at FROM streaks WHERE id = 1',
  );
  return rowToStreakData(row);
}

export function recordReviewAndUpdateStreak(
  userDb: SQLiteDatabase,
  today: string,
): Result<StreakUpdate, AppError> {
  try {
    const row = userDb.getFirstSync<StreakRow>(
      'SELECT id, current_streak, longest_streak, last_review_date, updated_at FROM streaks WHERE id = 1',
    );
    const current = rowToStreakData(row);

    if (current.lastReviewDate === today) {
      return { ok: true, value: { ...current, didIncrementToday: false } };
    }

    const isConsecutive = current.lastReviewDate === yesterdayKey(today);
    const newStreak = isConsecutive ? current.currentStreak + 1 : 1;
    const newLongest = Math.max(current.longestStreak, newStreak);
    const updatedAt = new Date().toISOString();

    userDb.runSync(
      `INSERT INTO streaks (id, current_streak, longest_streak, last_review_date, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         current_streak = excluded.current_streak,
         longest_streak = excluded.longest_streak,
         last_review_date = excluded.last_review_date,
         updated_at = excluded.updated_at`,
      newStreak,
      newLongest,
      today,
      updatedAt,
    );

    return {
      ok: true,
      value: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastReviewDate: today,
        didIncrementToday: true,
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'streak_persist_failed',
        message: 'Failed to update streak',
        cause,
      },
    };
  }
}

export type StreakCelebration = {
  shouldCelebrate: boolean;
  currentStreak: number;
};

/**
 * One-shot claim on the daily streak celebration: returns shouldCelebrate true
 * only when today already has streak credit and no celebration has been shown
 * today, and marks today celebrated in the same call. Every later call that
 * day — from a second session or the other session type — returns false, so
 * the animation plays at most once per day. Best-effort: any failure reads as
 * "don't celebrate" rather than an error.
 */
export function claimStreakCelebration(
  userDb: SQLiteDatabase,
  today: string,
): StreakCelebration {
  try {
    const row = userDb.getFirstSync<StreakRow & { last_celebrated_date: string | null }>(
      'SELECT id, current_streak, longest_streak, last_review_date, updated_at, last_celebrated_date FROM streaks WHERE id = 1',
    );

    if (!row || row.last_review_date !== today || row.last_celebrated_date === today) {
      return { shouldCelebrate: false, currentStreak: row?.current_streak ?? 0 };
    }

    userDb.runSync(
      'UPDATE streaks SET last_celebrated_date = ?, updated_at = ? WHERE id = 1',
      today,
      new Date().toISOString(),
    );

    return { shouldCelebrate: true, currentStreak: row.current_streak };
  } catch {
    return { shouldCelebrate: false, currentStreak: 0 };
  }
}
