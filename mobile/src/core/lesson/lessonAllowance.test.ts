import { DAILY_LESSON_BATCHES, LESSON_BACKLOG_THROTTLE_FULL } from '@/config/constants';

import { computeDailyAllowance } from './lessonAllowance';

describe('computeDailyAllowance', () => {
  it('grants itemsPerLesson × DAILY_LESSON_BATCHES per day with no backlog', () => {
    const five = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 0,
      reviewsDueCount: 0,
    });
    expect(five.total).toBe(5 * DAILY_LESSON_BATCHES);
    expect(five.remaining).toBe(five.total);

    const ten = computeDailyAllowance({
      itemsPerLesson: 10,
      itemsStartedToday: 0,
      reviewsDueCount: 0,
    });
    expect(ten.total).toBe(10 * DAILY_LESSON_BATCHES);
  });

  it('scales the allowance with itemsPerLesson', () => {
    for (const itemsPerLesson of [3, 7, 15]) {
      const allowance = computeDailyAllowance({
        itemsPerLesson,
        itemsStartedToday: 0,
        reviewsDueCount: 0,
      });
      expect(allowance.total).toBe(itemsPerLesson * DAILY_LESSON_BATCHES);
    }
  });

  it('subtracts items already started today', () => {
    const allowance = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 5,
      reviewsDueCount: 0,
    });
    expect(allowance.remaining).toBe(allowance.total - 5);
  });

  it('reaches zero when the allowance is exhausted and never goes negative', () => {
    const allowance = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 999,
      reviewsDueCount: 0,
    });
    expect(allowance.remaining).toBe(0);
  });

  it('shrinks the allowance as the review backlog grows', () => {
    const clear = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 5,
      reviewsDueCount: 0,
    });
    const backlogged = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 5,
      reviewsDueCount: 100,
    });
    expect(backlogged.total).toBeLessThan(clear.total);
    expect(backlogged.remaining).toBeLessThan(clear.remaining);
  });

  it('throttles to zero remaining at a huge backlog once lessons were done today', () => {
    const allowance = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 1,
      reviewsDueCount: LESSON_BACKLOG_THROTTLE_FULL + 50,
    });
    expect(allowance.remaining).toBe(0);
  });

  it('always allows one batch when nothing was started today, even with a backlog', () => {
    const allowance = computeDailyAllowance({
      itemsPerLesson: 5,
      itemsStartedToday: 0,
      reviewsDueCount: LESSON_BACKLOG_THROTTLE_FULL + 500,
    });
    expect(allowance.remaining).toBe(5);
  });
});
