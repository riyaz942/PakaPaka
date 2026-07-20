import { buildReviewForecast } from './reviewForecast';

// Local noon avoids UTC/local day-boundary surprises in bucketing assertions.
const NOW = new Date(2026, 6, 20, 12, 0, 0); // Mon 2026-07-20 local

function isoOnLocalDay(dayOffset: number, hour = 9): string {
  return new Date(2026, 6, 20 + dayOffset, hour).toISOString();
}

describe('buildReviewForecast', () => {
  it('returns seven zeroed days for an empty due list (day 1)', () => {
    const forecast = buildReviewForecast([], NOW);

    expect(forecast.days).toHaveLength(7);
    expect(forecast.days[0].dateKey).toBe('2026-07-20');
    expect(forecast.days[0].isToday).toBe(true);
    expect(forecast.days[6].dateKey).toBe('2026-07-26');
    expect(forecast.days.every((day) => day.count === 0)).toBe(true);
    expect(forecast.totalCount).toBe(0);
    expect(forecast.wallDateKey).toBeNull();
  });

  it('buckets dues into local calendar days and folds overdue into today', () => {
    const forecast = buildReviewForecast(
      [
        isoOnLocalDay(-3), // overdue → today
        isoOnLocalDay(0),
        isoOnLocalDay(2),
        isoOnLocalDay(2, 22),
        isoOnLocalDay(6),
        isoOnLocalDay(7), // beyond window → ignored
      ],
      NOW,
    );

    expect(forecast.days[0].count).toBe(2);
    expect(forecast.days[2].count).toBe(2);
    expect(forecast.days[6].count).toBe(1);
    expect(forecast.totalCount).toBe(5);
  });

  it('ignores invalid date strings', () => {
    const forecast = buildReviewForecast(['not-a-date', isoOnLocalDay(1)], NOW);
    expect(forecast.totalCount).toBe(1);
    expect(forecast.days[1].count).toBe(1);
  });

  it('flags a spike day meeting both the absolute floor and the ratio', () => {
    // Wed(+2) has 41 due, other days light: mean = 47/7 ≈ 6.7 → ceil(10.07)=11;
    // threshold = max(30, 11) = 30; 41 >= 30 → wall.
    const dues = [
      ...Array.from({ length: 41 }, () => isoOnLocalDay(2)),
      ...Array.from({ length: 6 }, (_, i) => isoOnLocalDay(i >= 2 ? i + 1 : i)),
    ];
    const forecast = buildReviewForecast(dues, NOW);

    expect(forecast.wallDateKey).toBe('2026-07-22');
  });

  it('does not flag a flat heavy week (ratio not met)', () => {
    // 35 due every day: max 35 >= 30 floor, but ceil(35 × 1.5) = 53 > 35.
    const dues = Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 35 }, () => isoOnLocalDay(day)),
    ).flat();
    const forecast = buildReviewForecast(dues, NOW);

    expect(forecast.wallDateKey).toBeNull();
  });

  it('does not flag a small spike below the absolute floor', () => {
    // Spike of 12 on one otherwise-empty week: ratio met but under 30 floor.
    const dues = Array.from({ length: 12 }, () => isoOnLocalDay(3));
    const forecast = buildReviewForecast(dues, NOW);

    expect(forecast.wallDateKey).toBeNull();
  });
});
