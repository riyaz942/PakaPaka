import type { SQLiteDatabase } from 'expo-sqlite';

import { setStudyStatus } from '@/data/user/itemStudyStatusRepository';
import { seedMissingSrsStatesForInProgress } from '@/data/user/srsStateRepository';
import type { AppError, Result } from '@/types/result.types';

/**
 * Marks lesson items as in_progress and seeds their SRS state so they enter
 * the review queue immediately (a fresh FSRS card is due now — this powers
 * the post-lesson "Quiz now" handoff).
 */
export function startLessonItems(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Result<void, AppError> {
  try {
    userDb.withTransactionSync(() => {
      for (const itemId of itemIds) {
        setStudyStatus(userDb, itemId, 'in_progress');
      }
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

  return seedMissingSrsStatesForInProgress(userDb, itemIds);
}
