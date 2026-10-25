import type { SQLiteDatabase } from 'expo-sqlite';

import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { setStudyStatus } from '@/data/user/itemStudyStatusRepository';
import { seedMissingSrsStatesForInProgress } from '@/data/user/srsStateRepository';
import type { AppError, Result } from '@/types/result.types';

/** Lesson items started on the given local calendar date (YYYY-MM-DD). */
export function getLessonItemsStartedOn(userDb: SQLiteDatabase, date: string): number {
  const row = userDb.getFirstSync<{ items_started: number }>(
    'SELECT items_started FROM daily_lesson_log WHERE date = ?',
    date,
  );
  return row?.items_started ?? 0;
}

/**
 * Marks lesson items as in_progress and seeds their SRS state so they enter
 * the review queue immediately (a fresh FSRS card is due now — this powers
 * the post-lesson "Quiz now" handoff).
 *
 * The daily lesson log is incremented in the same transaction that writes
 * item_study_status, so the daily allowance counter cannot drift from reality.
 *
 * Ids in `readOnceIds` (read-once cards) are marked `known` instead and get no
 * SRS state: they are never reviewed. They still count toward today's log.
 */
export function startLessonItems(
  userDb: SQLiteDatabase,
  itemIds: string[],
  readOnceIds: ReadonlySet<string> = new Set(),
): Result<void, AppError> {
  try {
    userDb.withTransactionSync(() => {
      for (const itemId of itemIds) {
        setStudyStatus(userDb, itemId, readOnceIds.has(itemId) ? 'known' : 'in_progress');
      }
      userDb.runSync(
        `INSERT INTO daily_lesson_log (date, items_started) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET
           items_started = items_started + excluded.items_started`,
        todayKey(),
        itemIds.length,
      );
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'lesson_start_failed',
        message: 'Failed to mark lesson items as in progress',
        userMessage: 'Your lesson could not be saved. Please try again.',
        cause,
      },
    };
  }

  return seedMissingSrsStatesForInProgress(
    userDb,
    itemIds.filter((itemId) => !readOnceIds.has(itemId)),
  );
}
