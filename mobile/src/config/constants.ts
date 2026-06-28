import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export const SESSION_INTENSITY_MINUTES: Record<SessionIntensity, number> = {
  relaxed: 15,
  intense: 30,
};

/** Max items held in the prefetch buffer ahead of the current item. */
export const MAX_PREFETCH = 5;

/** Max SRS rows fetched per queue build. */
export const QUEUE_FETCH_LIMIT = 100;

/** Weights for weighted round-robin interleaving in queue builder. */
export const INTERLEAVE_WEIGHTS: Record<string, number> = {
  kanji: 2,
  vocabulary: 2,
  grammar: 1,
  radical: 1,
};

/** Weight for FSRS score in priority formula (Epic 6 weakness bias). Unused until Epic 6. */
export const WEAKNESS_WEIGHT = 0.7;

/** Pause before auto-advancing after a correct answer (Epic 6 will make this configurable). */
export const REVIEW_CORRECT_AUTO_ADVANCE_MS = 800;
