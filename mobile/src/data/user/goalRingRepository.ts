import type { SQLiteDatabase } from 'expo-sqlite';

import { GOAL_RING_MIN_ACTIVE_DAYS } from '@/config/constants';
import {
  addDaysToKey,
  computeWeeklyGoalUpdate,
  initialGoalForIntensity,
  weekStartKey,
} from '@/core/cognitive-load/thresholdCalculator';
import { getActiveDayLoadsInRange } from '@/data/user/cognitiveLoadRepository';
import { getSessionIntensity } from '@/data/user/preferencesRepository';
import type { AppError, Result } from '@/types/result.types';

export type GoalRingState = {
  /** Sticky daily goal, in items; null = unset (seed from intensity base). */
  dailyGoalTarget: number | null;
  /** Monday (local) of the week the ratchet last ran for; null before first check. */
  goalWeekStart: string | null;
  consecutiveMissWeeks: number;
  /** Proposed higher goal awaiting user acknowledgement. */
  pendingRiseTo: number | null;
  /** Opt-in reduction offer awaiting user acceptance. */
  pendingReductionTo: number | null;
};

type GoalRingStateRow = {
  daily_goal_target: number | null;
  goal_week_start: string | null;
  consecutive_miss_weeks: number;
  pending_rise_to: number | null;
  pending_reduction_to: number | null;
};

const EMPTY_STATE: GoalRingState = {
  dailyGoalTarget: null,
  goalWeekStart: null,
  consecutiveMissWeeks: 0,
  pendingRiseTo: null,
  pendingReductionTo: null,
};

export function getGoalRingState(userDb: SQLiteDatabase): GoalRingState {
  const row = userDb.getFirstSync<GoalRingStateRow>(
    `SELECT daily_goal_target, goal_week_start, consecutive_miss_weeks,
            pending_rise_to, pending_reduction_to
     FROM goal_ring_state WHERE id = 1`,
  );
  if (!row) {
    return EMPTY_STATE;
  }
  return {
    dailyGoalTarget: row.daily_goal_target,
    goalWeekStart: row.goal_week_start,
    consecutiveMissWeeks: row.consecutive_miss_weeks,
    pendingRiseTo: row.pending_rise_to,
    pendingReductionTo: row.pending_reduction_to,
  };
}

/**
 * The ring's denominator: the sticky goal when set, otherwise the intensity
 * base. Intensity only seeds — it never overwrites a set goal.
 */
export function resolveDailyGoalTarget(userDb: SQLiteDatabase): number {
  const state = getGoalRingState(userDb);
  if (state.dailyGoalTarget !== null && state.dailyGoalTarget > 0) {
    return state.dailyGoalTarget;
  }
  return initialGoalForIntensity(getSessionIntensity(userDb) ?? 'relaxed');
}

function persistState(
  userDb: SQLiteDatabase,
  state: GoalRingState,
): Result<void, AppError> {
  try {
    userDb.runSync(
      `INSERT INTO goal_ring_state (
         id, daily_goal_target, goal_week_start, consecutive_miss_weeks,
         pending_rise_to, pending_reduction_to, updated_at
       ) VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         daily_goal_target = excluded.daily_goal_target,
         goal_week_start = excluded.goal_week_start,
         consecutive_miss_weeks = excluded.consecutive_miss_weeks,
         pending_rise_to = excluded.pending_rise_to,
         pending_reduction_to = excluded.pending_reduction_to,
         updated_at = excluded.updated_at`,
      state.dailyGoalTarget,
      state.goalWeekStart,
      state.consecutiveMissWeeks,
      state.pendingRiseTo,
      state.pendingReductionTo,
      new Date().toISOString(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'goal_ring_persist_failed',
        message: 'Failed to persist goal ring state',
        cause,
      },
    };
  }
}

/** Sets the sticky daily goal. Unbounded above (UX-DR33); must be > 0. */
export function setDailyGoalTarget(
  userDb: SQLiteDatabase,
  target: number,
): Result<void, AppError> {
  if (!Number.isFinite(target) || target <= 0) {
    return {
      ok: false,
      error: {
        code: 'goal_ring_invalid_target',
        message: `Daily goal must be greater than zero, got ${target}`,
      },
    };
  }
  const state = getGoalRingState(userDb);
  return persistState(userDb, {
    ...state,
    dailyGoalTarget: target,
    pendingRiseTo: null,
    pendingReductionTo: null,
  });
}

/** Accepts a pending rise: writes the target, clears all offers, resets misses. */
export function acceptPendingRise(userDb: SQLiteDatabase): Result<void, AppError> {
  const state = getGoalRingState(userDb);
  if (state.pendingRiseTo === null) {
    return { ok: true, value: undefined };
  }
  return persistState(userDb, {
    ...state,
    dailyGoalTarget: state.pendingRiseTo,
    pendingRiseTo: null,
    pendingReductionTo: null,
    consecutiveMissWeeks: 0,
  });
}

/** Accepts the opt-in reduction: lowers the target and clears all offers. */
export function acceptPendingReduction(userDb: SQLiteDatabase): Result<void, AppError> {
  const state = getGoalRingState(userDb);
  if (state.pendingReductionTo === null) {
    return { ok: true, value: undefined };
  }
  if (!Number.isFinite(state.pendingReductionTo) || state.pendingReductionTo <= 0) {
    return persistState(userDb, {
      ...state,
      pendingRiseTo: null,
      pendingReductionTo: null,
      consecutiveMissWeeks: 0,
    });
  }
  return persistState(userDb, {
    ...state,
    dailyGoalTarget: state.pendingReductionTo,
    pendingRiseTo: null,
    pendingReductionTo: null,
    consecutiveMissWeeks: 0,
  });
}

/** Declines the reduction offer: clears it and resets the miss counter. */
export function declinePendingReduction(userDb: SQLiteDatabase): Result<void, AppError> {
  const state = getGoalRingState(userDb);
  return persistState(userDb, {
    ...state,
    pendingReductionTo: null,
    consecutiveMissWeeks: 0,
  });
}

/**
 * Moves the ratchet's anchor to the current week without judging anything in
 * between. Used when vacation mode ends: `runWeeklyGoalCheck` walks every
 * Monday boundary since the last anchor and increments `consecutiveMissWeeks`
 * for each one, so without re-anchoring a multi-week break would greet the
 * user with a "been a tough stretch?" reduction offer they didn't earn.
 */
export function anchorGoalWeek(
  userDb: SQLiteDatabase,
  now: Date = new Date(),
): Result<void, AppError> {
  const state = getGoalRingState(userDb);
  return persistState(userDb, { ...state, goalWeekStart: weekStartKey(now) });
}

/**
 * Weekly ratchet driver (FR56–57). On each new Monday-start week it judges
 * every week since the last run (so multi-week app gaps still accumulate miss
 * / rise state). The goal itself is only ever changed by the user
 * (accept/Settings). First call ever just anchors `goalWeekStart`.
 */
export function runWeeklyGoalCheck(
  userDb: SQLiteDatabase,
  now: Date = new Date(),
): Result<void, AppError> {
  const state = getGoalRingState(userDb);
  const currentWeekStart = weekStartKey(now);

  if (state.goalWeekStart === currentWeekStart) {
    return { ok: true, value: undefined };
  }

  if (state.goalWeekStart === null) {
    return persistState(userDb, { ...state, goalWeekStart: currentWeekStart });
  }

  // Walk each Monday boundary from the last anchored week up to now so skipped
  // calendar weeks are still judged (miss streaks / rise offers stay accurate).
  let weekCursor = state.goalWeekStart;
  let consecutiveMissWeeks = state.consecutiveMissWeeks;
  let pendingRiseTo = state.pendingRiseTo;
  let pendingReductionTo = state.pendingReductionTo;
  const currentGoal = resolveDailyGoalTarget(userDb);

  while (weekCursor < currentWeekStart) {
    const nextWeekStart = addDaysToKey(weekCursor, 7);
    const activeDayLoads = getActiveDayLoadsInRange(userDb, weekCursor, nextWeekStart);
    const update = computeWeeklyGoalUpdate({
      currentGoal,
      activeDayLoads,
      consecutiveMissWeeks,
    });

    // Carry-forward (sample not met) keeps existing offers alive so an
    // unanswered prompt is not silently lost. A judged week replaces them.
    const sampleMet = activeDayLoads.length >= GOAL_RING_MIN_ACTIVE_DAYS;
    consecutiveMissWeeks = update.consecutiveMissWeeks;
    if (sampleMet) {
      pendingRiseTo = update.pendingRiseTo;
      pendingReductionTo = update.pendingReductionTo;
    }
    weekCursor = nextWeekStart;
  }

  return persistState(userDb, {
    ...state,
    goalWeekStart: currentWeekStart,
    consecutiveMissWeeks,
    pendingRiseTo,
    pendingReductionTo,
  });
}
