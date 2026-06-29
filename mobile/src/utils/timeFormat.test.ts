import {
  TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD,
  TIME_COMPRESSION_PER_ITEM_SECONDS,
  TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES,
} from '@/config/constants';

import {
  computeTimeCompression,
  estimateMultiAppMinutes,
  formatMinutes,
  type DomainCounts,
} from './timeFormat';

const ZERO_COUNTS: DomainCounts = {
  radical: 0,
  kanji: 0,
  vocabulary: 0,
  grammar: 0,
};

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
  it('returns 0 for zero items', () => {
    expect(estimateMultiAppMinutes(ZERO_COUNTS)).toBe(0);
  });

  it('applies per-item seconds without overhead for a single domain', () => {
    const counts: DomainCounts = { ...ZERO_COUNTS, kanji: 3 };
    const expected = Math.round((TIME_COMPRESSION_PER_ITEM_SECONDS.kanji * 3) / 60);
    expect(estimateMultiAppMinutes(counts)).toBe(expected);
  });

  it('adds session overhead when multiple domains have items', () => {
    const counts: DomainCounts = { ...ZERO_COUNTS, kanji: 2, vocabulary: 1 };
    const baseSeconds =
      TIME_COMPRESSION_PER_ITEM_SECONDS.kanji * 2 +
      TIME_COMPRESSION_PER_ITEM_SECONDS.vocabulary;
    const expected = Math.round(baseSeconds / 60 + TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES);
    expect(estimateMultiAppMinutes(counts)).toBe(expected);
    expect(TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD).toBe(2);
  });

  it('does not add overhead when only one domain has items', () => {
    const counts: DomainCounts = { ...ZERO_COUNTS, grammar: 5 };
    const expected = Math.round((TIME_COMPRESSION_PER_ITEM_SECONDS.grammar * 5) / 60);
    expect(estimateMultiAppMinutes(counts)).toBe(expected);
  });
});

describe('computeTimeCompression', () => {
  it('sets hasSavings false when actual minutes meet or exceed estimate', () => {
    const counts: DomainCounts = { ...ZERO_COUNTS, kanji: 1 };
    const estimated = estimateMultiAppMinutes(counts);
    const durationMs = estimated * 60_000;

    const result = computeTimeCompression({ durationMs, domainCounts: counts });
    expect(result.hasSavings).toBe(false);
    expect(result.savedMinutes).toBe(0);
    expect(result.actualMinutes).toBe(estimated);
  });

  it('sets hasSavings true when estimate exceeds actual', () => {
    const counts: DomainCounts = { ...ZERO_COUNTS, kanji: 10, vocabulary: 5, grammar: 3 };
    const durationMs = 5 * 60_000;

    const result = computeTimeCompression({ durationMs, domainCounts: counts });
    expect(result.estimatedMinutes).toBeGreaterThan(result.actualMinutes);
    expect(result.hasSavings).toBe(true);
    expect(result.savedMinutes).toBe(result.estimatedMinutes - result.actualMinutes);
  });
});
