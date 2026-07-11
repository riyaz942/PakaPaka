import {
  DAILY_LESSON_BATCHES,
  LESSON_BACKLOG_THROTTLE_FULL,
  LESSON_BACKLOG_THROTTLE_START,
} from '@/config/constants';
import { LESSON_SIZE_BY_INTENSITY } from '@/core/lesson/lessonPlanner';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export type DailyAllowanceInput = {
  intensity: SessionIntensity | null;
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
 * Base allowance is a few lesson batches per day, shrunk linearly toward zero
 * as the review backlog grows past LESSON_BACKLOG_THROTTLE_START. A user who
 * has started nothing today is always allowed at least one batch, so a
 * returning user with a backlog is never locked out entirely.
 */
export function computeDailyAllowance(input: DailyAllowanceInput): DailyAllowance {
  const { intensity, itemsStartedToday, reviewsDueCount } = input;
  const batchSize = LESSON_SIZE_BY_INTENSITY[intensity ?? 'relaxed'];
  const base = batchSize * DAILY_LESSON_BATCHES;

  const throttleRange = LESSON_BACKLOG_THROTTLE_FULL - LESSON_BACKLOG_THROTTLE_START;
  const backlogOverage = Math.max(0, reviewsDueCount - LESSON_BACKLOG_THROTTLE_START);
  const throttleFactor = Math.max(0, 1 - backlogOverage / throttleRange);
  const throttled = Math.round(base * throttleFactor);

  let remaining = Math.max(0, throttled - itemsStartedToday);
  if (itemsStartedToday === 0) {
    remaining = Math.max(remaining, batchSize);
  }

  return { total: Math.max(throttled, remaining), remaining };
}
