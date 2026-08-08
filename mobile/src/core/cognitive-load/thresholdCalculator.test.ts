import {
  COGNITIVE_LOAD_THRESHOLD_BASE,
  GOAL_RING_MIN_ACTIVE_DAYS,
  GOAL_RING_MISS_WEEKS_BEFORE_OFFER,
} from '@/config/constants';
import {
  addDaysToKey,
  computeWeeklyGoalUpdate,
  initialGoalForIntensity,
  weekStartKey,
} from '@/core/cognitive-load/thresholdCalculator';
import { SESSION_INTENSITY_VALUES } from '@/data/user/sessionIntensity.types';

describe('initialGoalForIntensity', () => {
  it('seeds from the intensity base', () => {
    expect(initialGoalForIntensity('relaxed')).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.relaxed);
    expect(initialGoalForIntensity('intense')).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.intense);
  });

  it('uses a higher base for intense than relaxed', () => {
    expect(COGNITIVE_LOAD_THRESHOLD_BASE.intense).toBeGreaterThan(
      COGNITIVE_LOAD_THRESHOLD_BASE.relaxed,
    );
  });

  it('seeds from the base for the light, steady and immersive tiers too', () => {
    expect(initialGoalForIntensity('light')).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.light);
    expect(initialGoalForIntensity('steady')).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.steady);
    expect(initialGoalForIntensity('immersive')).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.immersive);
  });

  it('rises strictly across the five tiers', () => {
    const bases = SESSION_INTENSITY_VALUES.map((tier) => COGNITIVE_LOAD_THRESHOLD_BASE[tier]);
    const ascending = bases.every((base, index) => index === 0 || base > bases[index - 1]);
    expect(ascending).toBe(true);
  });
});

describe('weekStartKey', () => {
  it('returns the local Monday for any day of the week', () => {
    // 2026-07-20 is a Monday.
    expect(weekStartKey(new Date(2026, 6, 20))).toBe('2026-07-20');
    expect(weekStartKey(new Date(2026, 6, 22))).toBe('2026-07-20'); // Wednesday
    expect(weekStartKey(new Date(2026, 6, 26))).toBe('2026-07-20'); // Sunday
  });

  it('crosses month boundaries correctly', () => {
    // 2026-08-01 is a Saturday → Monday is 2026-07-27.
    expect(weekStartKey(new Date(2026, 7, 1))).toBe('2026-07-27');
  });
});

describe('addDaysToKey', () => {
  it('adds and subtracts days across month boundaries', () => {
    expect(addDaysToKey('2026-07-20', 7)).toBe('2026-07-27');
    expect(addDaysToKey('2026-07-20', -7)).toBe('2026-07-13');
    expect(addDaysToKey('2026-08-01', -1)).toBe('2026-07-31');
  });
});

describe('computeWeeklyGoalUpdate', () => {
  it('carries the goal forward when the active-day sample is too small', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 30,
      activeDayLoads: Array(GOAL_RING_MIN_ACTIVE_DAYS - 1).fill(60),
      consecutiveMissWeeks: 1,
    });
    expect(result.pendingRiseTo).toBeNull();
    expect(result.pendingReductionTo).toBeNull();
    expect(result.consecutiveMissWeeks).toBe(1);
  });

  it('proposes a rise (pending, not applied) when the weekly mean beats the goal', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 30,
      activeDayLoads: [40, 50, 60],
      consecutiveMissWeeks: 1,
    });
    expect(result.pendingRiseTo).toBe(50);
    expect(result.pendingReductionTo).toBeNull();
    expect(result.consecutiveMissWeeks).toBe(0);
  });

  it('never auto-drops: a miss week holds the goal and increments the miss counter', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 50,
      activeDayLoads: [20, 25, 30],
      consecutiveMissWeeks: 0,
    });
    expect(result.pendingRiseTo).toBeNull();
    expect(result.pendingReductionTo).toBeNull();
    expect(result.consecutiveMissWeeks).toBe(1);
  });

  it('treats an exact-mean week as a hit (resets misses, no reduction)', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 40,
      activeDayLoads: [40, 40, 40],
      consecutiveMissWeeks: 2,
    });
    expect(result.pendingRiseTo).toBeNull();
    expect(result.pendingReductionTo).toBeNull();
    expect(result.consecutiveMissWeeks).toBe(0);
  });

  it('floors a near-zero mean proposal at 1 load unit', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 50,
      activeDayLoads: [0.1, 0.2, 0.1],
      consecutiveMissWeeks: GOAL_RING_MISS_WEEKS_BEFORE_OFFER - 1,
    });
    expect(result.pendingReductionTo).toBe(1);
    expect(result.consecutiveMissWeeks).toBe(GOAL_RING_MISS_WEEKS_BEFORE_OFFER);
  });

  it('offers an opt-in reduction after enough consecutive miss weeks', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 50,
      activeDayLoads: [20, 25, 30],
      consecutiveMissWeeks: GOAL_RING_MISS_WEEKS_BEFORE_OFFER - 1,
    });
    expect(result.pendingRiseTo).toBeNull();
    expect(result.pendingReductionTo).toBe(25);
    expect(result.consecutiveMissWeeks).toBe(GOAL_RING_MISS_WEEKS_BEFORE_OFFER);
  });

  it('rounds proposals to whole load units', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 30,
      activeDayLoads: [40, 41, 41],
      consecutiveMissWeeks: 0,
    });
    expect(result.pendingRiseTo).toBe(41);
  });

  it('does not clamp the proposal to any maximum', () => {
    const result = computeWeeklyGoalUpdate({
      currentGoal: 90,
      activeDayLoads: [200, 220, 240],
      consecutiveMissWeeks: 0,
    });
    expect(result.pendingRiseTo).toBe(220);
  });
});
