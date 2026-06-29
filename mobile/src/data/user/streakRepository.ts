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
): Result<StreakData, AppError> {
  try {
    const row = userDb.getFirstSync<StreakRow>(
      'SELECT id, current_streak, longest_streak, last_review_date, updated_at FROM streaks WHERE id = 1',
    );
    const current = rowToStreakData(row);

    if (current.lastReviewDate === today) {
      return { ok: true, value: current };
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
