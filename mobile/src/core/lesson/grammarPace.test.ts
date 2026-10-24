import {
  grammarDailyCap,
  grammarPileLimit,
  isGrammarSlotOpen,
  summarizeGrammarStarts,
} from './grammarPace';

it.each([
  [8, 1],
  [15, 1],
  [21, 1],
  [28, 2],
  [40, 3],
])('daily cap for %i items is %i', (d, c) => expect(grammarDailyCap(d)).toBe(c));

it.each([
  [15, 10],
  [28, 20],
  [40, 30],
])('pile limit for %i items is %i', (d, l) => expect(grammarPileLimit(d)).toBe(l));

describe('summarizeGrammarStarts', () => {
  const now = new Date(2026, 9, 24, 9, 0); // local 09:00
  const at = (d: Date) => d.toISOString();

  it('uses the local calendar day', () => {
    const lateYesterday = new Date(2026, 9, 23, 23, 30);
    const earlyToday = new Date(2026, 9, 24, 0, 15);
    expect(
      summarizeGrammarStarts(
        [
          { itemId: 'g1', startedAt: at(lateYesterday), stage: 'apprentice' },
          { itemId: 'g2', startedAt: at(earlyToday), stage: 'apprentice' },
        ],
        now,
      ).startedToday,
    ).toBe(1);
  });

  it('counts Apprentice grammar started in the last 14 days only', () => {
    const daysAgo = (n: number) => at(new Date(now.getTime() - n * 86_400_000));
    expect(
      summarizeGrammarStarts(
        [
          { itemId: 'a', startedAt: daysAgo(13), stage: 'apprentice' },
          { itemId: 'b', startedAt: daysAgo(15), stage: 'apprentice' },
          { itemId: 'c', startedAt: daysAgo(3), stage: 'guru' },
          { itemId: 'd', startedAt: daysAgo(1), stage: null },
        ],
        now,
      ).recentApprentice,
    ).toBe(2);
  });
});

it('slot closes at the daily cap', () => {
  expect(isGrammarSlotOpen({ startedToday: 1, recentApprentice: 0 }, 15)).toBe(false);
  expect(isGrammarSlotOpen({ startedToday: 1, recentApprentice: 0 }, 28)).toBe(true);
});

it('slot closes at the pile limit', () => {
  expect(isGrammarSlotOpen({ startedToday: 0, recentApprentice: 10 }, 15)).toBe(false);
  expect(isGrammarSlotOpen({ startedToday: 0, recentApprentice: 9 }, 15)).toBe(true);
});
