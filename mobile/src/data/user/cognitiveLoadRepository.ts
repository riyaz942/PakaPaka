import type { SQLiteDatabase } from 'expo-sqlite';

import type { DailyLoad } from '@/core/cognitive-load/cognitiveLoad.types';
import type { AppError, Result } from '@/types/result.types';

type CognitiveLoadRow = {
  date: string;
  load: number;
  threshold: number;
  updated_at: string;
};

/** Returns local calendar date as YYYY-MM-DD (device timezone, not UTC). */
export function todayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyLoad(userDb: SQLiteDatabase, date: string): DailyLoad | null {
  const row = userDb.getFirstSync<CognitiveLoadRow>(
    'SELECT date, load, threshold FROM cognitive_load_history WHERE date = ?',
    date,
  );
  if (!row) {
    return null;
  }
  return { date: row.date, load: row.load, threshold: row.threshold };
}

export function getRecentDailyLoads(
  userDb: SQLiteDatabase,
  beforeDate: string,
  limit: number,
): number[] {
  const rows = userDb.getAllSync<{ load: number }>(
    'SELECT load FROM cognitive_load_history WHERE date < ? ORDER BY date DESC LIMIT ?',
    beforeDate,
    limit,
  );
  return rows.map((row) => row.load);
}

/**
 * Daily loads for active days (load > 0) within [startInclusive, endExclusive).
 * Feeds the weekly goal recalculation — rest days are excluded by definition.
 */
export function getActiveDayLoadsInRange(
  userDb: SQLiteDatabase,
  startInclusive: string,
  endExclusive: string,
): number[] {
  const rows = userDb.getAllSync<{ load: number }>(
    'SELECT load FROM cognitive_load_history WHERE date >= ? AND date < ? AND load > 0 ORDER BY date ASC',
    startInclusive,
    endExclusive,
  );
  return rows.map((row) => row.load);
}

export function addDailyLoad(
  userDb: SQLiteDatabase,
  params: { date: string; increment: number; threshold: number },
): Result<void, AppError> {
  try {
    const existing = getDailyLoad(userDb, params.date);
    const currentLoad = existing?.load ?? 0;
    const nextLoad = currentLoad + params.increment;
    const updatedAt = new Date().toISOString();

    userDb.runSync(
      `INSERT INTO cognitive_load_history (date, load, threshold, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         load = excluded.load,
         threshold = excluded.threshold,
         updated_at = excluded.updated_at`,
      params.date,
      nextLoad,
      params.threshold,
      updatedAt,
    );

    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'cognitive_load_persist_failed',
        message: 'Failed to persist cognitive load',
        cause,
      },
    };
  }
}
