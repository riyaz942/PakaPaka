import type { JLPTLevel } from '@/data/curriculum/curriculum.types';

/**
 * Turn budget (FR94, open item **OA4**).
 *
 * The budget is a *steer*, not a cutoff: it is injected into the system prompt
 * so the model paces the scene toward a natural end, and the app never
 * truncates a conversation when it is reached. A hard cutoff would drop the
 * learner mid-exchange, which is exactly what the wrap-up marker exists to
 * avoid.
 *
 * The constants below are placeholders. OA4 — the calibrated relationship
 * between level, completion, and a comfortable scene length — is an explicitly
 * deferred open item, not a blocker for this story.
 */

/** OA4 placeholder: turns a complete beginner should be steered toward. */
const BASE_TURNS = 8;

/** OA4 placeholder: extra turns granted at full completion of the level. */
const COMPLETION_BONUS_TURNS = 6;

/** OA4 placeholder: extra turns per level above N5. */
const LEVEL_BONUS_TURNS = 2;

/** OA4 placeholder: hard bounds so a malformed stat can't produce a silly prompt. */
const MIN_TURNS = 4;
const MAX_TURNS = 30;

const LEVEL_ORDER: readonly JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

export type CompletionStats = {
  /** Items the learner has studied at the active level. */
  studiedItems: number;
  /** Total items available at the active level. */
  totalItems: number;
};

/**
 * How many exchanges to steer the scene toward. Pure — takes stats, returns a
 * number, reads nothing.
 */
export function computeTurnBudget(level: JLPTLevel, stats: CompletionStats): number {
  const levelIndex = Math.max(0, LEVEL_ORDER.indexOf(level));

  const completion =
    stats.totalItems > 0
      ? Math.min(1, Math.max(0, stats.studiedItems / stats.totalItems))
      : 0;

  const budget = Math.round(
    BASE_TURNS + levelIndex * LEVEL_BONUS_TURNS + completion * COMPLETION_BONUS_TURNS,
  );

  return Math.min(MAX_TURNS, Math.max(MIN_TURNS, budget));
}
