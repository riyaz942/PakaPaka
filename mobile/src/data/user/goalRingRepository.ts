import type { SQLiteDatabase } from 'expo-sqlite';

import { computeDailyGoalTarget } from '@/core/cognitive-load/thresholdCalculator';
import { computeDailyAllowance } from '@/core/lesson/lessonAllowance';
import { buildLessonPlan } from '@/data/lessonPlan';
import { countServableDueItems } from '@/data/reviewEligibility';
import { getDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { getLessonItemsStartedOn } from '@/data/user/lessonProgressRepository';
import { getDailyLessonItems, getLessonItemCount } from '@/data/user/preferencesRepository';

/**
 * Today's goal ring target: the daily lesson allowance plus today's reviews
 * (answered + still due). Recomputed on every read — there is no stored goal.
 *
 * The lesson part is capped to what can be learned today: items already
 * started plus items ready now. On a day when new items wait on reviews, the
 * ring can still reach 100%.
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
  const lessonAllowanceTotal =
    allowance.remaining > 0
      ? Math.min(
          allowance.total,
          lessonItemsToday +
            buildLessonPlan(curriculumDb, userDb, {
              ignoreAllowance: true,
              sizeOverride: allowance.remaining,
            }).items.length,
        )
      : allowance.total;
  return computeDailyGoalTarget({
    lessonAllowanceTotal,
    todayLoad: getDailyLoad(userDb, today)?.load ?? 0,
    lessonItemsToday,
    reviewsDueCount,
  });
}
