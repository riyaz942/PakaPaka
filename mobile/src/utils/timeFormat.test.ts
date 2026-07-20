import { estimateMultiAppMinutes, formatMinutes, hasSavings } from './timeFormat';

describe('formatMinutes', () => {
  it('floors elapsed ms to whole minutes with minimum of 1', () => {
    expect(formatMinutes(0)).toBe(1);
    expect(formatMinutes(30_000)).toBe(1);
    expect(formatMinutes(60_000)).toBe(1);
    expect(formatMinutes(119_999)).toBe(1);
    expect(formatMinutes(120_000)).toBe(2);
  });
});

describe('estimateMultiAppMinutes', () => {
  it('returns 0 for an empty session', () => {
    expect(
      estimateMultiAppMinutes({ radical: 0, kanji: 0, vocabulary: 0, grammar: 0 }),
    ).toBe(0);
  });

  it('applies no overhead for a single-domain session', () => {
    // 10 kanji × 40s = 400s → round(6.67) = 7 min, no overhead.
    expect(
      estimateMultiAppMinutes({ radical: 0, kanji: 10, vocabulary: 0, grammar: 0 }),
    ).toBe(7);
  });

  it('adds per-extra-app overhead once two or more domains are present', () => {
    // 8 kanji ×40 + 5 vocab ×30 + 2 grammar ×50 = 320+150+100 = 570s → round(9.5)=10
    // 3 domains → 2 extra apps × 5 min = +10 → 20 min.
    expect(
      estimateMultiAppMinutes({ radical: 0, kanji: 8, vocabulary: 5, grammar: 2 }),
    ).toBe(20);
  });

  it('uses Math.round rather than inflating with ceil', () => {
    // 1 radical × 15s = 15s → round(0.25) = 0.
    expect(
      estimateMultiAppMinutes({ radical: 1, kanji: 0, vocabulary: 0, grammar: 0 }),
    ).toBe(0);
  });
});

describe('hasSavings', () => {
  it('is true only when the estimate beats actual time', () => {
    expect(hasSavings(20, 12)).toBe(true);
    expect(hasSavings(12, 12)).toBe(false);
    expect(hasSavings(8, 12)).toBe(false);
  });
});
