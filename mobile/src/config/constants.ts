import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

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
 * New lesson items per day by session intensity — the base daily lesson
 * allowance. Reviews are never capped; they come on top of this.
 */
export const DAILY_LESSON_ITEMS_BY_INTENSITY: Record<SessionIntensity, number> = {
  light: 8,
  relaxed: 15,
  steady: 21,
  intense: 28,
  immersive: 40,
};

/** Default new items introduced per lesson; user-configurable in Settings. */
export const DEFAULT_LESSON_ITEM_COUNT = 5;

/** Review backlog size at which the daily lesson allowance starts shrinking. */
export const LESSON_BACKLOG_THROTTLE_START = 50;

/** Review backlog size at which the daily lesson allowance reaches zero. */
export const LESSON_BACKLOG_THROTTLE_FULL = 150;

/** Daily lesson items per new grammar point per day (D6: cap = max(1, round(daily / this))). */
export const LESSON_GRAMMAR_DAILY_PER_ITEMS = 15;

/** New grammar waits while recent Apprentice grammar reaches this many times the daily cap. */
export const LESSON_GRAMMAR_PILE_LIMIT_PER_DAILY_CAP = 10;

/** Only grammar started within this many days counts toward the pile limit. */
export const LESSON_GRAMMAR_PILE_WINDOW_DAYS = 14;

/** Lesson type share ∝ lead × unstarted items of that type in the level (D8). */
export const LESSON_TYPE_LEAD = { radical: 4, kanji: 2, vocabulary: 1 } as const;

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

/** Days of active shadow mode before the non-blocking "ready to switch?" prompt appears. */
export const SHADOW_MODE_SWITCH_PROMPT_DAYS = 14;

/** How many days a snoozed switch prompt stays hidden. */
export const SHADOW_MODE_SNOOZE_DAYS = 7;
