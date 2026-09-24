import {
  LESSON_BACKLOG_THROTTLE_FULL,
  LESSON_BACKLOG_THROTTLE_START,
} from '@/config/constants';

export type DailyAllowanceInput = {
  /** New items per day from the session intensity preset. */
  dailyLessonItems: number;
  /** New items shown per lesson (Settings-configurable, independent of pace). */
  itemsPerLesson: number;
  /** Lesson items already started today (from daily_lesson_log). */
  itemsStartedToday: number;
  /** Reviews currently due — a large backlog throttles new lessons. */
  reviewsDueCount: number;
};

export type DailyAllowance = {
  /** Total items allowed today after backlog throttling. */
  total: number;
  /** Items still allowed today; 0 when the allowance is exhausted. */
  remaining: number;
};

/**
 * Daily lesson allowance, WaniKani-style: a per-day cap on new items so a
 * motivated evening doesn't become 900 apprentice reviews next week.
 *
 * Base allowance is the intensity preset's items per day, shrunk linearly toward zero
 * as the review backlog grows past LESSON_BACKLOG_THROTTLE_START. A user who
 * has started nothing today is always allowed at least one batch, so a
 * returning user with a backlog is never locked out entirely.
 */
export function computeDailyAllowance(input: DailyAllowanceInput): DailyAllowance {
  const { dailyLessonItems, itemsPerLesson, itemsStartedToday, reviewsDueCount } = input;
  const base = dailyLessonItems;

  const throttleRange = LESSON_BACKLOG_THROTTLE_FULL - LESSON_BACKLOG_THROTTLE_START;
  const backlogOverage = Math.max(0, reviewsDueCount - LESSON_BACKLOG_THROTTLE_START);
  const throttleFactor = Math.max(0, 1 - backlogOverage / throttleRange);
  const throttled = Math.round(base * throttleFactor);

  let remaining = Math.max(0, throttled - itemsStartedToday);
  if (itemsStartedToday === 0) {
    remaining = Math.max(remaining, itemsPerLesson);
  }

  return { total: Math.max(throttled, remaining), remaining };
}
