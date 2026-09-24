import { LESSON_BACKLOG_THROTTLE_FULL } from '@/config/constants';

import { computeDailyAllowance } from './lessonAllowance';

describe('computeDailyAllowance', () => {
  it('grants the daily lesson items per day with no backlog', () => {
    const allowance = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 0,
      reviewsDueCount: 0,
    });
    expect(allowance.total).toBe(15);
    expect(allowance.remaining).toBe(15);
  });

  it('does not scale the allowance with itemsPerLesson', () => {
    for (const itemsPerLesson of [3, 7, 10]) {
      const allowance = computeDailyAllowance({
        dailyLessonItems: 21,
        itemsPerLesson,
        itemsStartedToday: 0,
        reviewsDueCount: 0,
      });
      expect(allowance.total).toBe(21);
    }
  });

  it('subtracts items already started today', () => {
    const allowance = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 5,
      reviewsDueCount: 0,
    });
    expect(allowance.remaining).toBe(allowance.total - 5);
  });

  it('reaches zero when the allowance is exhausted and never goes negative', () => {
    const allowance = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 999,
      reviewsDueCount: 0,
    });
    expect(allowance.remaining).toBe(0);
  });

  it('shrinks the allowance as the review backlog grows', () => {
    const clear = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 5,
      reviewsDueCount: 0,
    });
    const backlogged = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 5,
      reviewsDueCount: 100,
    });
    expect(backlogged.total).toBeLessThan(clear.total);
    expect(backlogged.remaining).toBeLessThan(clear.remaining);
  });

  it('throttles to zero remaining at a huge backlog once lessons were done today', () => {
    const allowance = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 1,
      reviewsDueCount: LESSON_BACKLOG_THROTTLE_FULL + 50,
    });
    expect(allowance.remaining).toBe(0);
  });

  it('always allows one batch when nothing was started today, even with a backlog', () => {
    const allowance = computeDailyAllowance({
      dailyLessonItems: 15,
      itemsPerLesson: 5,
      itemsStartedToday: 0,
      reviewsDueCount: LESSON_BACKLOG_THROTTLE_FULL + 500,
    });
    expect(allowance.remaining).toBe(5);
  });
});
