import { computeDailyGoalTarget } from './thresholdCalculator';

describe('computeDailyGoalTarget', () => {
  it('is lessons + reviews done today + reviews still due', () => {
    expect(
      computeDailyGoalTarget({
        lessonAllowanceTotal: 15,
        todayLoad: 25,
        lessonItemsToday: 5,
        reviewsDueCount: 30,
      }),
    ).toBe(15 + 20 + 30);
  });

  it('never counts negative reviews when load lags lesson starts', () => {
    expect(
      computeDailyGoalTarget({
        lessonAllowanceTotal: 15,
        todayLoad: 0,
        lessonItemsToday: 5,
        reviewsDueCount: 0,
      }),
    ).toBe(15);
  });

  it('never returns less than 1', () => {
    expect(
      computeDailyGoalTarget({
        lessonAllowanceTotal: 0,
        todayLoad: 0,
        lessonItemsToday: 0,
        reviewsDueCount: 0,
      }),
    ).toBe(1);
  });
});
