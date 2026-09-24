import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getVacationStartedAt,
  setVacationStartedAt,
} from '@/data/user/preferencesRepository';
import { shiftDueDatesAfter } from '@/data/user/srsStateRepository';
import type { AppError, Result } from '@/types/result.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type VacationResumeSummary = {
  /** Cards pushed forward so the queue looks like it did before the break. */
  shiftedCount: number;
  /** Whole days paused, for the confirmation copy. */
  days: number;
};

/** True while reviews and lessons are frozen. */
export function isVacationActive(userDb: SQLiteDatabase): boolean {
  return getVacationStartedAt(userDb) !== null;
}

export function startVacation(userDb: SQLiteDatabase, now: Date = new Date()): void {
  if (isVacationActive(userDb)) return; // don't reset the clock on a re-toggle
  setVacationStartedAt(userDb, now.toISOString());
}

/**
 * Ends vacation mode and gives back the time: every not-yet-due card is pushed
 * forward by the length of the break, so the user returns to the queue they
 * left rather than a wall of overdue items.
 */
export function endVacation(
  userDb: SQLiteDatabase,
  now: Date = new Date(),
): Result<VacationResumeSummary, AppError> {
  const startedAt = getVacationStartedAt(userDb);
  if (startedAt === null) {
    return { ok: true, value: { shiftedCount: 0, days: 0 } };
  }

  try {
    // A non-positive span means the device clock moved backwards. Shifting on
    // that would pull cards *earlier*, so skip it — but still turn vacation
    // off, or the user is stuck paused until the clock catches up.
    const shiftMs = Math.max(0, now.getTime() - new Date(startedAt).getTime());
    const shiftedCount = shiftDueDatesAfter(userDb, startedAt, shiftMs);

    setVacationStartedAt(userDb, null);

    return {
      ok: true,
      value: { shiftedCount, days: Math.floor(shiftMs / MS_PER_DAY) },
    };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'vacation_resume_failed',
        message: 'Failed to reschedule reviews when ending vacation mode',
        userMessage: 'Vacation mode could not be turned off. Please try again.',
        cause,
      },
    };
  }
}
