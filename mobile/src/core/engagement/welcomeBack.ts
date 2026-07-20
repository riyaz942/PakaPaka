import {
  WELCOME_BACK_ABSENCE_DAYS,
  WELCOME_BACK_MIN_DUE,
  WELCOME_BACK_SLICE,
} from '@/config/constants';

export type WelcomeBackOffer = {
  /** Items in the eased slice (min of WELCOME_BACK_SLICE and dueCount). */
  sliceSize: number;
  dueCount: number;
};

function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00Z`).getTime();
  const to = new Date(`${toKey}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * Welcome-back triage (FR61): offered only to a *returning* learner — someone
 * who has studied before, has been away ≥ WELCOME_BACK_ABSENCE_DAYS, and now
 * faces a backlog ≥ WELCOME_BACK_MIN_DUE. Never for day-1 users (that is
 * onboarding's job), and never auto-started.
 */
export function computeWelcomeBackOffer(params: {
  lastActiveDate: string | null;
  todayKey: string;
  dueCount: number;
}): WelcomeBackOffer | null {
  const { lastActiveDate, todayKey, dueCount } = params;
  if (lastActiveDate === null) return null;
  if (dueCount < WELCOME_BACK_MIN_DUE) return null;
  if (daysBetweenKeys(lastActiveDate, todayKey) < WELCOME_BACK_ABSENCE_DAYS) return null;

  return { sliceSize: Math.min(WELCOME_BACK_SLICE, dueCount), dueCount };
}
