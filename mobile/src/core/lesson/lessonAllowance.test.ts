import { DAILY_LESSON_BATCHES, LESSON_BACKLOG_THROTTLE_FULL } from '@/config/constants';
import { LESSON_SIZE_BY_INTENSITY } from '@/core/lesson/lessonPlanner';

import { computeDailyAllowance } from './lessonAllowance';

describe('computeDailyAllowance', () => {
  it('grants batch size × DAILY_LESSON_BATCHES per day with no backlog', () => {
    const relaxed = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 0,
      reviewsDueCount: 0,
    });
    expect(relaxed.total).toBe(LESSON_SIZE_BY_INTENSITY.relaxed * DAILY_LESSON_BATCHES);
    expect(relaxed.remaining).toBe(relaxed.total);

    const intense = computeDailyAllowance({
      intensity: 'intense',
      itemsStartedToday: 0,
      reviewsDueCount: 0,
    });
    expect(intense.total).toBe(LESSON_SIZE_BY_INTENSITY.intense * DAILY_LESSON_BATCHES);
  });

  it('defaults to relaxed when intensity is unset', () => {
    const allowance = computeDailyAllowance({
      intensity: null,
      itemsStartedToday: 0,
      reviewsDueCount: 0,
    });
    expect(allowance.total).toBe(LESSON_SIZE_BY_INTENSITY.relaxed * DAILY_LESSON_BATCHES);
  });

  it('subtracts items already started today', () => {
    const allowance = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 5,
      reviewsDueCount: 0,
    });
    expect(allowance.remaining).toBe(allowance.total - 5);
  });

  it('reaches zero when the allowance is exhausted and never goes negative', () => {
    const allowance = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 999,
      reviewsDueCount: 0,
    });
    expect(allowance.remaining).toBe(0);
  });

  it('shrinks the allowance as the review backlog grows', () => {
    const clear = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 5,
      reviewsDueCount: 0,
    });
    const backlogged = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 5,
      reviewsDueCount: 100,
    });
    expect(backlogged.total).toBeLessThan(clear.total);
    expect(backlogged.remaining).toBeLessThan(clear.remaining);
  });

  it('throttles to zero remaining at a huge backlog once lessons were done today', () => {
    const allowance = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 1,
      reviewsDueCount: LESSON_BACKLOG_THROTTLE_FULL + 50,
    });
    expect(allowance.remaining).toBe(0);
  });

  it('always allows one batch when nothing was started today, even with a backlog', () => {
    const allowance = computeDailyAllowance({
      intensity: 'relaxed',
      itemsStartedToday: 0,
      reviewsDueCount: LESSON_BACKLOG_THROTTLE_FULL + 500,
    });
    expect(allowance.remaining).toBe(LESSON_SIZE_BY_INTENSITY.relaxed);
  });
});
