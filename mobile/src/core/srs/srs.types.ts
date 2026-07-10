import type { RelatedItem, ReinforcementLink } from '@/core/content/content.types';

export type SRSStageLabel = 'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned';

export type FsrsStateString = 'new' | 'learning' | 'review' | 'relearning';

export type SRSState = {
  itemId: string;
  stability: number;
  difficulty: number;
  dueDate: string; // ISO 8601 UTC
  fsrsState: FsrsStateString;
  reps: number;
  lapses: number;
  /** ts-fsrs learning-step index (Card.learning_steps) — which step a Learning/Relearning card is on. */
  learningSteps: number;
  isBurned: boolean;
  srsStageLabel: SRSStageLabel;
  /** ISO timestamp of the last graded review, or null if never reviewed in-app. */
  lastReviewedAt: string | null;
  updatedAt: string;
};

/** 1=Again 2=Hard 3=Good 4=Easy — matches ts-fsrs Rating enum (Manual excluded) */
export type ReviewGrade = 1 | 2 | 3 | 4;

/** Stage movement produced by a grade, surfaced on the answer reveal. */
export type StageTransition = {
  from: SRSStageLabel;
  to: SRSStageLabel;
};

export type ReviewAnswerKey = {
  acceptedMeanings: string[];
  acceptedReadings: string[];
  grammar?: {
    structure: string;
    conjugationRules: Record<string, unknown>;
    acceptedForms: string[];
  };
};

export type ReviewItem = {
  itemId: string;
  itemType: 'radical' | 'kanji' | 'vocabulary' | 'grammar';
  primaryForm: string;
  meanings: string[];
  srsState: SRSState;
  promptType: 'reading' | 'meaning' | 'production';
  mnemonic?: string | null;
  personalMnemonic?: string | null;
  answerKey: ReviewAnswerKey;
  relatedItems: RelatedItem[];
  reinforcementLink: ReinforcementLink | null;
};

export type QueueBuildOptions = {
  now?: Date;
  limit?: number;
  weaknessScores?: Map<string, number>; // reserved for Epic 6; defaults to 0
  /** When true, apply weakness bias to within-bucket sort order. Default: true when weaknessScores is provided. */
  weaknessBiasEnabled?: boolean;
};

/**
 * Per-item outcome counters persisted in `weakness_stats`.
 * Typos are tracked separately and do NOT count as misses in the weakness score.
 */
export type WeaknessStats = {
  itemId: string;
  correctCount: number;
  incorrectCount: number;
  typoCount: number;
  /** ISO timestamp of the last incorrect answer, or null if none. */
  lastErrorAt: string | null;
  /** Prompt type that was last missed: 'meaning' | 'reading' | 'production', or null. */
  lastErrorType: string | null;
  /** Pattern tag IDs matched to this item (for confusion cluster grouping). */
  patternTags: string[];
};

/**
 * A confusion cluster: a group of items that share a pattern and have a
 * sustained low accuracy. Emitted only above CLUSTER_MIN_SAMPLE and below
 * CLUSTER_ACCURACY_THRESHOLD.
 */
export type ConfusionCluster = {
  /** Pattern definition ID this cluster maps to. */
  id: string;
  /** Human-readable label, e.g. "て-form vs た-form". */
  label: string;
  /** Learner-facing copy sentence, e.g. "You often confuse て-form and た-form". */
  copy: string;
  /** Accuracy rate [0, 1] for items in this cluster. */
  accuracy: number;
  /** Total number of attempts across all items in this cluster. */
  sampleSize: number;
  /** Item IDs that belong to this cluster. */
  itemIds: string[];
};

/**
 * App-side pattern definition for confusion cluster detection.
 * Keyed to known item slugs or grammar reinforcement_tags since curriculum
 * has no item-level confusion tags.
 */
export type PatternDefinition = {
  /** Unique pattern identifier (snake_case). */
  id: string;
  /** Human-readable label used in cluster copy. */
  label: string;
  /** Known item slugs or grammar reinforcement_tags that match this pattern. */
  itemSlugsOrTags: string[];
};
