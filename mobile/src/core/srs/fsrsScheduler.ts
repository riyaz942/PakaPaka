import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

import type { FsrsStateString, ReviewGrade, SRSStageLabel, SRSState } from './srs.types';

const SCHEDULER = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  // One short confirmation step after a lesson, then graduate to the FSRS
  // stability curve. The ts-fsrs default (['1m', '10m']) would bring the first
  // correct answer back in one minute — too aggressive for a WaniKani-style app.
  learning_steps: ['10m'],
  relearning_steps: ['10m'],
});

// Stability (days) at which an item transitions to "burned" stage
const BURN_STABILITY_THRESHOLD = 365;
// Stability (days) at which an item transitions from "master" to "enlightened"
const ENLIGHTENED_STABILITY_THRESHOLD = 120;
/**
 * Highest stability a reading-locked item may reach — an hour under the
 * enlightened boundary, so both the stage label and the interval stop at
 * master. Clamping only the label would let the item silently accrue a
 * two-year interval and stop coming back, the opposite of the intent.
 */
const MASTER_STABILITY_CAP = ENLIGHTENED_STABILITY_THRESHOLD - 1 / 24;
const DAY_MS = 24 * 60 * 60 * 1000;

function fsrsStateToString(state: State): FsrsStateString {
  switch (state) {
    case State.New:
      return 'new';
    case State.Learning:
      return 'learning';
    case State.Review:
      return 'review';
    case State.Relearning:
      return 'relearning';
    default:
      return 'new';
  }
}

function stringToFsrsState(state: FsrsStateString): State {
  switch (state) {
    case 'new':
      return State.New;
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    default:
      return State.New;
  }
}

export function toFsrsCard(dbRow: SRSState, now: Date = new Date()): Card {
  // Prefer the explicit review timestamp; fall back to updatedAt only for
  // legacy/imported rows that predate last_reviewed_at.
  const lastReviewIso =
    dbRow.lastReviewedAt ?? (dbRow.reps > 0 ? dbRow.updatedAt : null);
  const lastReview = lastReviewIso !== null ? new Date(lastReviewIso) : undefined;
  const elapsedDays =
    lastReview !== undefined
      ? Math.max(0, (now.getTime() - lastReview.getTime()) / DAY_MS)
      : 0;
  const due = new Date(dbRow.dueDate);
  const scheduledDays =
    lastReview !== undefined
      ? Math.max(0, (due.getTime() - lastReview.getTime()) / DAY_MS)
      : 0;

  return {
    due,
    stability: dbRow.stability,
    difficulty: dbRow.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    reps: dbRow.reps,
    lapses: dbRow.lapses,
    learning_steps: dbRow.learningSteps,
    state: stringToFsrsState(dbRow.fsrsState),
    last_review: lastReview,
  };
}

/**
 * Maps FSRS card fields to a WaniKani-style stage label.
 * Stage boundaries align with fsrsConverter.ts import stage semantics.
 */
export function mapFsrsStateToStageLabel(card: Card, isBurned: boolean): SRSStageLabel {
  if (isBurned) return 'burned';
  if (card.stability >= BURN_STABILITY_THRESHOLD) return 'burned';
  // Relearning = lapsed; reads as apprentice-like, never guru+.
  if (
    card.state === State.New ||
    card.state === State.Learning ||
    card.state === State.Relearning
  ) {
    return 'apprentice';
  }
  // Low-stability Review cards are still apprentice territory (importer maps
  // WaniKani stages 3-4 to Review state with stability < 7).
  if (card.stability < 7) return 'apprentice';
  if (card.stability < 21) return 'guru';
  if (card.stability < ENLIGHTENED_STABILITY_THRESHOLD) return 'master';
  return 'enlightened';
}

/**
 * v2 rule 3 — hold a meaning-only word at master. Both the stability and the
 * scheduled interval are pulled under the enlightened boundary; the label
 * follows from the stability, so it needs no separate handling.
 */
function capAtMaster(card: Card, now: Date): Card {
  const maxDue = new Date(now.getTime() + MASTER_STABILITY_CAP * DAY_MS);
  const due = card.due instanceof Date ? card.due : new Date(card.due);
  if (card.stability < MASTER_STABILITY_CAP && due.getTime() <= maxDue.getTime()) {
    return card;
  }
  return {
    ...card,
    stability: Math.min(card.stability, MASTER_STABILITY_CAP),
    due: due.getTime() > maxDue.getTime() ? maxDue : due,
  };
}

export function fromFsrsCard(card: Card, previous: SRSState, now: Date = new Date()): SRSState {
  const isBurned = previous.isBurned || card.stability >= BURN_STABILITY_THRESHOLD;
  const srsStageLabel = mapFsrsStateToStageLabel(card, isBurned);
  const dueDate = card.due instanceof Date ? card.due.toISOString() : String(card.due);
  const nowIso = now.toISOString();
  return {
    ...previous,
    stability: card.stability,
    difficulty: card.difficulty,
    dueDate,
    fsrsState: fsrsStateToString(card.state),
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    isBurned,
    srsStageLabel,
    lastReviewedAt: nowIso,
    updatedAt: nowIso,
  };
}

const REVIEW_GRADE_TO_RATING: Record<ReviewGrade, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

export type GradeOptions = {
  /**
   * v2 rule 3: hold the item at master. Set for a vocabulary item whose reading
   * card is not live yet — you cannot burn a word you cannot read.
   */
  capAtMaster?: boolean;
};

export function gradeItem(
  state: SRSState,
  grade: ReviewGrade,
  now: Date = new Date(),
  options: GradeOptions = {},
): SRSState {
  const card = toFsrsCard(state, now);
  const rating = REVIEW_GRADE_TO_RATING[grade];
  const result = SCHEDULER.next(card, now, rating);
  const next = options.capAtMaster ? capAtMaster(result.card, now) : result.card;
  return fromFsrsCard(next, state, now);
}

/** Seed a fresh FSRS card for an in_progress item without existing SRS state. */
export function createInitialSrsState(itemId: string, now: Date = new Date()): SRSState {
  const card = createEmptyCard(now);
  const isBurned = false;
  const srsStageLabel = mapFsrsStateToStageLabel(card, isBurned);
  return {
    itemId,
    stability: card.stability,
    difficulty: card.difficulty,
    dueDate: now.toISOString(),
    fsrsState: fsrsStateToString(card.state),
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    isBurned,
    srsStageLabel,
    lastReviewedAt: null,
    updatedAt: now.toISOString(),
  };
}
