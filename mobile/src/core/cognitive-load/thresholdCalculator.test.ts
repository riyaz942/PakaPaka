import { computeThreshold } from '@/core/cognitive-load/thresholdCalculator';
import {
  COGNITIVE_LOAD_THRESHOLD_BASE,
  COGNITIVE_LOAD_THRESHOLD_MAX,
  COGNITIVE_LOAD_THRESHOLD_MIN,
} from '@/config/constants';

describe('thresholdCalculator', () => {
  it('returns intensity base when recent history is empty', () => {
    expect(computeThreshold({ intensity: 'relaxed', recentLoads: [] })).toBe(
      COGNITIVE_LOAD_THRESHOLD_BASE.relaxed,
    );
    expect(computeThreshold({ intensity: 'intense', recentLoads: [] })).toBe(
      COGNITIVE_LOAD_THRESHOLD_BASE.intense,
    );
  });

  it('uses a higher base for intense than relaxed', () => {
    expect(COGNITIVE_LOAD_THRESHOLD_BASE.intense).toBeGreaterThan(
      COGNITIVE_LOAD_THRESHOLD_BASE.relaxed,
    );
  });

  it('raises threshold when recent daily loads are sustained high', () => {
    const baseOnly = computeThreshold({ intensity: 'relaxed', recentLoads: [] });
    const adapted = computeThreshold({
      intensity: 'relaxed',
      recentLoads: [45, 48, 50, 46, 44],
    });
    expect(adapted).toBeGreaterThan(baseOnly);
  });

  it('never exceeds MAX or drops below MIN', () => {
    const high = computeThreshold({
      intensity: 'intense',
      recentLoads: Array(7).fill(200),
    });
    expect(high).toBeLessThanOrEqual(COGNITIVE_LOAD_THRESHOLD_MAX);

    const low = computeThreshold({
      intensity: 'relaxed',
      recentLoads: Array(7).fill(1),
    });
    expect(low).toBeGreaterThanOrEqual(COGNITIVE_LOAD_THRESHOLD_MIN);
  });

  it('returns a non-zero threshold on first session', () => {
    const threshold = computeThreshold({ intensity: 'relaxed', recentLoads: [] });
    expect(threshold).toBeGreaterThan(0);
  });
});
