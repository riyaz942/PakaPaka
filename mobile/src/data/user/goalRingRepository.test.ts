import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { COGNITIVE_LOAD_THRESHOLD_BASE } from '@/config/constants';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { migration015GoalRingState } from '@/data/migrations/015_goal_ring_state';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { addDailyLoad } from '@/data/user/cognitiveLoadRepository';
import {
  acceptPendingReduction,
  acceptPendingRise,
  declinePendingReduction,
  getGoalRingState,
  resolveDailyGoalTarget,
  runWeeklyGoalCheck,
  setDailyGoalTarget,
} from '@/data/user/goalRingRepository';
import { setSessionIntensity } from '@/data/user/preferencesRepository';

describe('goalRingRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration008CognitiveLoadHistory,
      migration015GoalRingState,
    ]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('returns empty state before any writes', async () => {
    const userDb = await createUserDb();
    expect(getGoalRingState(userDb)).toEqual({
      dailyGoalTarget: null,
      goalWeekStart: null,
      consecutiveMissWeeks: 0,
      pendingRiseTo: null,
      pendingReductionTo: null,
    });
  });

  it('resolves the goal from intensity base when unset', async () => {
    const userDb = await createUserDb();
    expect(resolveDailyGoalTarget(userDb)).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.relaxed);
    setSessionIntensity(userDb, 'intense');
    expect(resolveDailyGoalTarget(userDb)).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.intense);
  });

  it('round-trips an unbounded sticky goal and ignores later intensity changes', async () => {
    const userDb = await createUserDb();
    expect(setDailyGoalTarget(userDb, 200).ok).toBe(true);
    expect(resolveDailyGoalTarget(userDb)).toBe(200);
    setSessionIntensity(userDb, 'intense');
    expect(resolveDailyGoalTarget(userDb)).toBe(200);
  });

  it('rejects non-positive goals', async () => {
    const userDb = await createUserDb();
    expect(setDailyGoalTarget(userDb, 0).ok).toBe(false);
    expect(setDailyGoalTarget(userDb, -5).ok).toBe(false);
  });

  it('anchors the week on the first check without judging a prior week', async () => {
    const userDb = await createUserDb();
    const monday = new Date(2026, 6, 20); // Monday 2026-07-20
    expect(runWeeklyGoalCheck(userDb, monday).ok).toBe(true);
    const state = getGoalRingState(userDb);
    expect(state.goalWeekStart).toBe('2026-07-20');
    expect(state.pendingRiseTo).toBeNull();
  });

  it('is a no-op within the same week', async () => {
    const userDb = await createUserDb();
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 20));
    addDailyLoad(userDb, { date: '2026-07-20', increment: 99, threshold: 30 });
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 24)); // Friday, same week
    expect(getGoalRingState(userDb).pendingRiseTo).toBeNull();
  });

  it('sets a pending rise (not the target) after a strong week', async () => {
    const userDb = await createUserDb();
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 13)); // anchor week of Jul 13
    addDailyLoad(userDb, { date: '2026-07-14', increment: 50, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-07-15', increment: 60, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-07-17', increment: 70, threshold: 30 });

    expect(runWeeklyGoalCheck(userDb, new Date(2026, 6, 20)).ok).toBe(true);

    const state = getGoalRingState(userDb);
    expect(state.pendingRiseTo).toBe(60);
    expect(state.dailyGoalTarget).toBeNull(); // never silently applied
    expect(resolveDailyGoalTarget(userDb)).toBe(COGNITIVE_LOAD_THRESHOLD_BASE.relaxed);
    expect(state.goalWeekStart).toBe('2026-07-20');
  });

  it('carries the goal forward when fewer than the minimum active days', async () => {
    const userDb = await createUserDb();
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 13));
    addDailyLoad(userDb, { date: '2026-07-14', increment: 90, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-07-15', increment: 90, threshold: 30 });

    runWeeklyGoalCheck(userDb, new Date(2026, 6, 20));

    const state = getGoalRingState(userDb);
    expect(state.pendingRiseTo).toBeNull();
    expect(state.consecutiveMissWeeks).toBe(0);
  });

  it('accumulates miss weeks and eventually offers an opt-in reduction', async () => {
    const userDb = await createUserDb();
    expect(setDailyGoalTarget(userDb, 100).ok).toBe(true);
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 6)); // anchor week of Jul 6

    // Week of Jul 6: three active days well under goal.
    addDailyLoad(userDb, { date: '2026-07-07', increment: 20, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-07-08', increment: 20, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-07-09', increment: 20, threshold: 100 });
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 13));
    expect(getGoalRingState(userDb).consecutiveMissWeeks).toBe(1);
    expect(getGoalRingState(userDb).pendingReductionTo).toBeNull();

    // Week of Jul 13: another miss week.
    addDailyLoad(userDb, { date: '2026-07-14', increment: 30, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-07-15', increment: 30, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-07-16', increment: 30, threshold: 100 });
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 20));

    const state = getGoalRingState(userDb);
    expect(state.consecutiveMissWeeks).toBe(2);
    expect(state.pendingReductionTo).toBe(30);
    expect(state.dailyGoalTarget).toBe(100); // still never auto-dropped
  });

  it('accepting a rise writes the target and clears pending state', async () => {
    const userDb = await createUserDb();
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 13));
    addDailyLoad(userDb, { date: '2026-07-14', increment: 50, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-07-15', increment: 50, threshold: 30 });
    addDailyLoad(userDb, { date: '2026-07-16', increment: 50, threshold: 30 });
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 20));

    expect(acceptPendingRise(userDb).ok).toBe(true);
    const state = getGoalRingState(userDb);
    expect(state.dailyGoalTarget).toBe(50);
    expect(state.pendingRiseTo).toBeNull();
    expect(state.consecutiveMissWeeks).toBe(0);
  });

  it('accepting a reduction lowers the target; declining clears the offer and misses', async () => {
    const userDb = await createUserDb();
    setDailyGoalTarget(userDb, 100);
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 6));
    for (const week of [
      ['2026-07-07', '2026-07-08', '2026-07-09'],
      ['2026-07-14', '2026-07-15', '2026-07-16'],
    ]) {
      for (const date of week) {
        addDailyLoad(userDb, { date, increment: 20, threshold: 100 });
      }
    }
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 13));
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 20));
    expect(getGoalRingState(userDb).pendingReductionTo).toBe(20);

    expect(declinePendingReduction(userDb).ok).toBe(true);
    let state = getGoalRingState(userDb);
    expect(state.pendingReductionTo).toBeNull();
    expect(state.consecutiveMissWeeks).toBe(0);
    expect(state.dailyGoalTarget).toBe(100);

    // Re-seed an offer and accept it this time.
    setDailyGoalTarget(userDb, 100);
    runWeeklyGoalCheck(userDb, new Date(2026, 6, 27));
    runWeeklyGoalCheck(userDb, new Date(2026, 7, 3));
    // Two fresh miss weeks are required again; simulate directly via state:
    // (weeks of Jul 20 & Jul 27 had no activity → carry-forward, no offer)
    expect(getGoalRingState(userDb).pendingReductionTo).toBeNull();

    // Direct accept path with a seeded offer.
    addDailyLoad(userDb, { date: '2026-08-04', increment: 10, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-08-05', increment: 10, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-08-06', increment: 10, threshold: 100 });
    runWeeklyGoalCheck(userDb, new Date(2026, 7, 10));
    addDailyLoad(userDb, { date: '2026-08-11', increment: 10, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-08-12', increment: 10, threshold: 100 });
    addDailyLoad(userDb, { date: '2026-08-13', increment: 10, threshold: 100 });
    runWeeklyGoalCheck(userDb, new Date(2026, 7, 17));
    expect(getGoalRingState(userDb).pendingReductionTo).toBe(10);

    expect(acceptPendingReduction(userDb).ok).toBe(true);
    state = getGoalRingState(userDb);
    expect(state.dailyGoalTarget).toBe(10);
    expect(state.pendingReductionTo).toBeNull();
    expect(state.consecutiveMissWeeks).toBe(0);
  });
});
