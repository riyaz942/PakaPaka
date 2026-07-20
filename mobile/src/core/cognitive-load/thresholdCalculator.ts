import {
  COGNITIVE_LOAD_THRESHOLD_BASE,
  GOAL_RING_MIN_ACTIVE_DAYS,
  GOAL_RING_MISS_WEEKS_BEFORE_OFFER,
} from '@/config/constants';
import type { SessionIntensity } from './cognitiveLoad.types';

/**
 * Seed goal when the user has never set or accepted one. Intensity only seeds
 * calibration — it never overwrites a user-set or ratcheted goal.
 */
export function initialGoalForIntensity(intensity: SessionIntensity): number {
  return COGNITIVE_LOAD_THRESHOLD_BASE[intensity];
}

/**
 * Week boundary: local calendar week starting Monday (device timezone).
 * Returns the Monday of the week containing `date` as YYYY-MM-DD.
 */
export function weekStartKey(date: Date): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): Sunday = 0 … Saturday = 6; shift so Monday is the week start.
  const daysSinceMonday = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - daysSinceMonday);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD key in local time. */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  const outYear = date.getFullYear();
  const outMonth = String(date.getMonth() + 1).padStart(2, '0');
  const outDay = String(date.getDate()).padStart(2, '0');
  return `${outYear}-${outMonth}-${outDay}`;
}

type WeeklyGoalUpdateInput = {
  /** Sticky daily goal in load units (denominator of the ring). */
  currentGoal: number;
  /** Prior week's daily loads for active days only (load > 0); rest days excluded. */
  activeDayLoads: number[];
  consecutiveMissWeeks: number;
};

type WeeklyGoalUpdate = {
  /** Proposed higher goal awaiting user acknowledgement — never auto-applied. */
  pendingRiseTo: number | null;
  /** Opt-in reduction offer after sustained miss weeks — never auto-applied. */
  pendingReductionTo: number | null;
  consecutiveMissWeeks: number;
};

/**
 * Weekly goal ratchet (FR56–57). The proposal is the *mean* of active-day
 * loads — not the best day — so overshoot stays reachable roughly half the
 * time. The goal itself is never mutated here: a rise becomes a pending
 * prompt, a sustained miss becomes a pending opt-in reduction offer, and an
 * insufficient sample carries everything forward unchanged.
 */
export function computeWeeklyGoalUpdate(input: WeeklyGoalUpdateInput): WeeklyGoalUpdate {
  if (input.activeDayLoads.length < GOAL_RING_MIN_ACTIVE_DAYS) {
    return {
      pendingRiseTo: null,
      pendingReductionTo: null,
      consecutiveMissWeeks: input.consecutiveMissWeeks,
    };
  }

  const mean =
    input.activeDayLoads.reduce((sum, load) => sum + load, 0) / input.activeDayLoads.length;
  // Floor at 1 so a pending reduction can never become a non-positive sticky goal.
  const proposal = Math.max(1, Math.round(mean));

  if (proposal > input.currentGoal) {
    return { pendingRiseTo: proposal, pendingReductionTo: null, consecutiveMissWeeks: 0 };
  }

  // Exact match is a hit — meeting the goal resets the miss streak (Task 2: miss
  // only when mean < goal).
  if (proposal === input.currentGoal) {
    return { pendingRiseTo: null, pendingReductionTo: null, consecutiveMissWeeks: 0 };
  }

  const missWeeks = input.consecutiveMissWeeks + 1;
  return {
    pendingRiseTo: null,
    pendingReductionTo: missWeeks >= GOAL_RING_MISS_WEEKS_BEFORE_OFFER ? proposal : null,
    consecutiveMissWeeks: missWeeks,
  };
}
