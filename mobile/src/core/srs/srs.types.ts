import type { RelatedItem, ReinforcementLink } from '@/core/content/content.types';
import type { BuildDiagnosisKey } from '@/core/grammar/mistakes/mistake.types';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

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
  /**
   * Readings that are valid for the item but not for the prompted reading type
   * (kanji: kun'yomi on the on'yomi card). Never accepted as correct — they
   * drive the non-terminal `wrong_reading_type` nudge (FR81/FR82).
   */
  alternateReadings?: string[];
  grammar?: {
    structure: string;
    conjugationRules: Record<string, unknown>;
    acceptedForms: string[];
  };
};

/** One word of a grammar sentence, as the Build card lists it (dictionary form). */
export type GrammarVocabEntry = {
  itemId: string;
  primaryForm: string;
  /** Bracket furigana of the dictionary form; null for kana-only words. */
  furigana: string | null;
};

/** The sentence one grammar card asks about (spec §5.3). */
export type GrammarSentenceCard = {
  /** The sentence's plain Japanese — its identity in user.db (spec §5.1). */
  sentenceKey: string;
  japanese: string;
  furigana: string | null;
  english: string;
  spans: PassageWordSpan[];
  grammarSpan: { start: number; end: number };
  register: 'polite' | 'plain';
  /** Distinct span words in sentence order. */
  vocabulary: GrammarVocabEntry[];
  /** Furigana notation graded correct: the sentence, then its `valid` alternates. */
  answers: string[];
  /** Furigana notation that triggers the same-family nudge (D6). */
  otherGrammarAnswers: string[];
  /**
   * Normalised answers the learner saved for this sentence. Mutable on
   * purpose: "My answer is correct too" appends here so a same-session retry
   * of this card (same object) accepts it at once.
   */
  userAnswers: string[];
  /** Build cards only: the cut answers and word facts that explain a wrong answer. */
  diagnosisKey: BuildDiagnosisKey | null;
};

export type ReviewItem = {
  itemId: string;
  itemType: 'radical' | 'kanji' | 'vocabulary' | 'grammar';
  primaryForm: string;
  /**
   * Bracket-annotated reading of `primaryForm` (vocabulary only). The meaning
   * prompt renders through it so a word written with untaught kanji is still
   * readable; the reading prompt never does — that would be the answer.
   */
  furigana?: string | null;
  /** Curriculum display meaning, shown prominently (may pack alternatives: "ground / one"). */
  displayMeaning: string;
  /** Every accepted meaning — curriculum answers, derived candidates, and user synonyms. */
  meanings: string[];
  srsState: SRSState;
  promptType: 'reading' | 'meaning' | 'production';
  /**
   * True on both cards of a two-card pair (kanji meaning + on'yomi, vocabulary meaning + reading, grammar Read + Build).
   * The session provider holds the pair's first-attempt outcomes and applies a
   * single worst-of-both FSRS write when both are terminal (FR83).
   */
  isTwoCardItem?: boolean;
  /** Grammar pair only: the Read card's sentence (spec §3.1). Set on both cards of the pair. */
  grammarRead?: GrammarSentenceCard;
  /** Grammar pair only: the Build card's sentence (spec §3.2). Set on both cards of the pair. */
  grammarBuild?: GrammarSentenceCard;
  /**
   * v2 rule 3: a vocabulary item asked for its meaning only, because some kanji
   * written in it is not yet at guru. Its FSRS interval is capped at the master
   * ceiling — you cannot burn a word you cannot read.
   */
  readingLocked?: boolean;
  /** The un-learned kanji holding `readingLocked`, in teaching order. */
  readingLockedBy?: string[];
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
  /**
   * Item IDs exempt from the due-date filter (Home refresher handoff): a
   * not-yet-due weak item may enter the queue. Burned / 'known' / lock filters
   * still apply.
   */
  dueExemptItemIds?: Set<string>;
  /** Random source in [0, 1) for choosing which card of a kanji/vocabulary pair leads. Default: Math.random. */
  rng?: () => number;
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
