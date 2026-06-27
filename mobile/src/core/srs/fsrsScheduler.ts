import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

import type { FsrsStateString, ReviewGrade, SRSStageLabel, SRSState } from './srs.types';

const SCHEDULER = fsrs({ request_retention: 0.9, maximum_interval: 3650 });

// Stability (days) at which an item transitions to "burned" stage
const BURN_STABILITY_THRESHOLD = 365;
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
  const lastReview = dbRow.reps > 0 ? new Date(dbRow.updatedAt) : undefined;
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
    learning_steps: 0,
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
  if (card.state === State.New || card.state === State.Learning) return 'apprentice';
  if (card.stability < 21) return 'guru';
  if (card.stability < 120) return 'master';
  return 'enlightened';
}

export function fromFsrsCard(card: Card, previous: SRSState): SRSState {
  const isBurned = previous.isBurned || card.stability >= BURN_STABILITY_THRESHOLD;
  const srsStageLabel = mapFsrsStateToStageLabel(card, isBurned);
  const dueDate = card.due instanceof Date ? card.due.toISOString() : String(card.due);
  return {
    ...previous,
    stability: card.stability,
    difficulty: card.difficulty,
    dueDate,
    fsrsState: fsrsStateToString(card.state),
    reps: card.reps,
    lapses: card.lapses,
    isBurned,
    srsStageLabel,
    updatedAt: new Date().toISOString(),
  };
}

const REVIEW_GRADE_TO_RATING: Record<ReviewGrade, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

export function gradeItem(state: SRSState, grade: ReviewGrade, now: Date = new Date()): SRSState {
  const card = toFsrsCard(state, now);
  const rating = REVIEW_GRADE_TO_RATING[grade];
  const result = SCHEDULER.next(card, now, rating);
  return fromFsrsCard(result.card, state);
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
    isBurned,
    srsStageLabel,
    updatedAt: now.toISOString(),
  };
}
