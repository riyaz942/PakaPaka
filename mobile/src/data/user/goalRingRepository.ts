import type { SQLiteDatabase } from 'expo-sqlite';

import { computeDailyGoalTarget } from '@/core/cognitive-load/thresholdCalculator';
import { computeDailyAllowance } from '@/core/lesson/lessonAllowance';
import { countServableDueItems } from '@/data/reviewEligibility';
import { getDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { getLessonItemsStartedOn } from '@/data/user/lessonProgressRepository';
import { getDailyLessonItems, getLessonItemCount } from '@/data/user/preferencesRepository';

/**
 * Today's goal ring target: the daily lesson allowance plus today's reviews
 * (answered + still due). Recomputed on every read — there is no stored goal.
 */
export function resolveDailyGoalTarget(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
): number {
  const today = todayKey();
  const lessonItemsToday = getLessonItemsStartedOn(userDb, today);
  const reviewsDueCount = countServableDueItems(curriculumDb, userDb);
  const allowance = computeDailyAllowance({
    dailyLessonItems: getDailyLessonItems(userDb),
    itemsPerLesson: getLessonItemCount(userDb),
    itemsStartedToday: lessonItemsToday,
    reviewsDueCount,
  });
  return computeDailyGoalTarget({
    lessonAllowanceTotal: allowance.total,
    todayLoad: getDailyLoad(userDb, today)?.load ?? 0,
    lessonItemsToday,
    reviewsDueCount,
  });
}
