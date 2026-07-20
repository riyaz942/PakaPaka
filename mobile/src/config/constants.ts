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

/** Weight for FSRS score in priority formula (Epic 6 weakness bias). */
export const WEAKNESS_WEIGHT = 0.7;

/**
 * Weight for weakness score in the priority formula:
 * priority = WEAKNESS_WEIGHT × fsrsUrgency + WEAKNESS_BIAS_WEIGHT × weaknessScore
 */
export const WEAKNESS_BIAS_WEIGHT = 0.3;

/**
 * Minimum number of total answer attempts (correct + incorrect) required before
 * a non-zero weakness score is returned for an item.
 * Below this threshold, score = 0 to avoid false positives on new items.
 */
export const WEAKNESS_MIN_SAMPLE = 3;

/**
 * Minimum total attempt count across all items in a pattern group before
 * a confusion cluster is emitted.
 */
export const CLUSTER_MIN_SAMPLE = 5;

/**
 * Accuracy rate at or below which a confusion cluster is surfaced.
 * E.g., 0.6 means 60% accuracy or worse triggers a cluster.
 */
export const CLUSTER_ACCURACY_THRESHOLD = 0.6;

/**
 * Lightning Mode delay: pause before auto-advancing after a correct answer.
 * Only runs when the `review_auto_advance` Settings toggle is ON — the default
 * review loop waits indefinitely for Return/Continue (FR84).
 */
export const REVIEW_CORRECT_AUTO_ADVANCE_MS = 800;

/**
 * Base cognitive load per item type (tunable defaults).
 * Kanji and grammar are heaviest; radicals are lightest.
 * Calibrated so a typical relaxed session (~15 mixed items) reaches ~100% threshold.
 */
export const COGNITIVE_LOAD_WEIGHTS: Record<'radical' | 'kanji' | 'vocabulary' | 'grammar', number> = {
  radical: 1,
  kanji: 3,
  grammar: 3,
  vocabulary: 2,
};

/**
 * Maturity multiplier by SRS stage — apprentice items cost the most mental energy.
 */
export const COGNITIVE_LOAD_MATURITY_MULTIPLIER: Record<
  'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned',
  number
> = {
  apprentice: 1.0,
  guru: 0.7,
  master: 0.5,
  enlightened: 0.4,
  burned: 0.3,
};

/** Extra load multiplier applied when the learner answers incorrectly. */
export const INCORRECT_LOAD_SURCHARGE = 1.5;

/**
 * Base daily load threshold by session intensity (load units, not minutes).
 * Relaxed (~15 items): avg ~2 units/item × 15 ≈ 30 → 100% at threshold 30.
 * Intense (~30 items): higher ceiling so sustained study can fill the ring more gradually.
 */
export const COGNITIVE_LOAD_THRESHOLD_BASE: Record<SessionIntensity, number> = {
  relaxed: 30,
  intense: 55,
};

/** Floor for adapted threshold — never collapses below this on light days. */
export const COGNITIVE_LOAD_THRESHOLD_MIN = 20;

/**
 * @deprecated The goal ring has no ceiling (FR55/FR57): the goal is unbounded
 * and overshoot >100% is celebrated, never clamped. Kept only so historical
 * references compile; do not use in new code.
 */
export const COGNITIVE_LOAD_THRESHOLD_MAX = 90;

/** Number of prior calendar days used for threshold adaptation. */
export const COGNITIVE_LOAD_HISTORY_WINDOW = 7;

/**
 * Blend factor toward recent daily load when adapting threshold (0–1).
 * 0.35 means 35% weight on rolling average, 65% on intensity base.
 */
export const COGNITIVE_LOAD_THRESHOLD_ADAPTATION_GAIN = 0.35;

/**
 * Minimum active days (load > 0) in the prior week before the weekly goal
 * recalculation is accepted; below this the current goal carries forward.
 */
export const GOAL_RING_MIN_ACTIVE_DAYS = 3;

/**
 * Consecutive miss weeks (weekly mean below goal, sample met) before the app
 * *offers* an opt-in goal reduction. The goal never auto-drops.
 */
export const GOAL_RING_MISS_WEEKS_BEFORE_OFFER = 2;

/**
 * Daily lesson allowance = lesson batch size × this multiplier
 * (15/day relaxed, 30/day intense). Advisory — "Learn anyway" bypasses it.
 */
export const DAILY_LESSON_BATCHES = 3;

/** Review backlog size at which the daily lesson allowance starts shrinking. */
export const LESSON_BACKLOG_THROTTLE_START = 50;

/** Review backlog size at which the daily lesson allowance reaches zero. */
export const LESSON_BACKLOG_THROTTLE_FULL = 150;

/** Priority nudge applied to graph-related items after a correct answer. */
export const RELATED_ITEM_BOOST_DELTA = 0.15;

/** Max cumulative boost per item — prevents queue starvation. */
export const RELATED_ITEM_BOOST_CAP = 1.0;

/** Progressive hint button labels (grammar prompts only). */
export const HINT_BUTTON_LABEL = 'Hint';
export function hintButtonLabel(revealed: number, total: number): string {
  if (revealed >= total) return HINT_BUTTON_LABEL;
  if (revealed === 0) return HINT_BUTTON_LABEL;
  return `${HINT_BUTTON_LABEL} (${revealed}/${total})`;
}

/**
 * Shadow mode (Epic 8, post-MVP) — build-level gate. Ships `false` so shipping this
 * story changes no observable behavior; enabling it is a deliberate future build change.
 */
export const SHADOW_MODE_FEATURE_ENABLED = false;

/**
 * Passage unlock coverage (FR60/FR68): a passage unlocks when this fraction of
 * its linked vocab + grammar items is at Guru or above (burned counts).
 */
export const PASSAGE_UNLOCK_COVERAGE = 0.9;

/** Rows fetched per Browse page (FR62 virtualized paginated list). */
export const BROWSE_PAGE_SIZE = 40;

/**
 * Debounce before a Browse search fans out to SQLite (FR65). SQLite reads are
 * synchronous, so this is the only thing standing between a fast typist and a
 * query per keystroke.
 */
export const BROWSE_SEARCH_DEBOUNCE_MS = 200;

/**
 * Debounce for the filter drawer's live "Apply (N)" count (FR64). Shorter than
 * search: toggling a facet chip should feel like it answers immediately.
 */
export const BROWSE_COUNT_DEBOUNCE_MS = 120;

/** Minimum due count on a single forecast day before it can be flagged as a wall. */
export const FORECAST_WALL_MIN_DUE = 30;

/** A wall day must also carry at least this multiple of the week's mean daily count. */
export const FORECAST_WALL_RATIO = 1.5;

/** How many at-risk items are listed on Home (within the FR59 5–10 band). */
export const AT_RISK_TOP_N = 8;

/** Days without study activity before welcome-back triage can appear. */
export const WELCOME_BACK_ABSENCE_DAYS = 3;

/** Minimum review backlog before welcome-back triage offers a slice. */
export const WELCOME_BACK_MIN_DUE = 40;

/** Size of the eased "20 of your N due" welcome-back review slice. */
export const WELCOME_BACK_SLICE = 20;

/**
 * Per-item minutes a learner would plausibly spend in separate single-purpose
 * apps (FR33b) — deliberately conservative estimates.
 */
export const TIME_COMPRESSION_PER_ITEM_SECONDS: Record<
  'radical' | 'kanji' | 'vocabulary' | 'grammar',
  number
> = {
  radical: 15,
  kanji: 40,
  vocabulary: 30,
  grammar: 50,
};

/** App-switching overhead added per extra single-purpose app (FR33b). */
export const TIME_COMPRESSION_SESSION_OVERHEAD_MINUTES = 5;

/** Overhead only applies when the session spans at least this many domains. */
export const TIME_COMPRESSION_MIN_DOMAINS_FOR_OVERHEAD = 2;

/** Days of active shadow mode before the non-blocking "ready to switch?" prompt appears. */
export const SHADOW_MODE_SWITCH_PROMPT_DAYS = 14;

/** How many days a snoozed switch prompt stays hidden. */
export const SHADOW_MODE_SNOOZE_DAYS = 7;
