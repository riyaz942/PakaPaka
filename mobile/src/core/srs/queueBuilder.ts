import { INTERLEAVE_WEIGHTS as CONFIG_INTERLEAVE_WEIGHTS, WEAKNESS_BIAS_WEIGHT, WEAKNESS_WEIGHT } from '@/config/constants';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type {
  ContentItemSummary,
  ContentItemType,
  ContentParentItem,
  ContentStudyStatus,
  RelatedItem,
  ReinforcementLink,
} from '@/core/content/content.types';

import { resolvePromptType } from './promptResolver';
import type { ReviewItem, QueueBuildOptions, SRSState, ReviewAnswerKey } from './srs.types';
import { computePriority, normalizeFsrsUrgency } from './weaknessEngine';

/**
 * Weighted round-robin interleaving weights (kanji:2, vocabulary:2, grammar:1, radical:1).
 * Re-exported here per AC2 — canonical values live in config/constants.ts.
 */
export const INTERLEAVE_WEIGHTS: Record<ContentItemType, number> = {
  kanji: CONFIG_INTERLEAVE_WEIGHTS.kanji,
  vocabulary: CONFIG_INTERLEAVE_WEIGHTS.vocabulary,
  grammar: CONFIG_INTERLEAVE_WEIGHTS.grammar,
  radical: CONFIG_INTERLEAVE_WEIGHTS.radical,
};

/**
 * Weighted round-robin interleaving algorithm:
 * 1. Partition due items into per-type buckets sorted by due_date ASC.
 * 2. Repeat until all buckets are empty: for each type, dequeue up to
 *    INTERLEAVE_WEIGHTS[type] items from that bucket.
 * 3. Missing types are skipped — no padding from other buckets.
 */

export type QueueInputItem = {
  srsState: SRSState;
  curriculumItem: ContentItemSummary;
  parents: ContentParentItem[];
  parentStatuses: Map<string, ContentStudyStatus>;
  studyStatus: ContentStudyStatus | null;
  personalMnemonic?: string | null;
  answerKey: ReviewAnswerKey;
  /** Bounded ordering nudge from related-item boosts; default 0 */
  boost?: number;
  relatedItems?: RelatedItem[];
  reinforcementLink?: ReinforcementLink | null;
};

const TYPE_ORDER: ContentItemType[] = ['kanji', 'vocabulary', 'grammar', 'radical'];

export function buildReviewQueue(
  items: QueueInputItem[],
  options: QueueBuildOptions = {},
): ReviewItem[] {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();

  // Filter: due, not burned, unlocked, not known
  const eligible = items.filter((item) => {
    if (item.srsState.isBurned) return false;
    if (item.studyStatus === 'known') return false;
    if (!isItemUnlocked(item.parents, item.parentStatuses)) return false;
    if (item.srsState.dueDate > nowIso) return false;
    return true;
  });

  // Partition into per-type buckets sorted by due_date ASC
  const buckets = new Map<ContentItemType, QueueInputItem[]>();
  for (const type of TYPE_ORDER) {
    buckets.set(type, []);
  }
  for (const item of eligible) {
    const bucket = buckets.get(item.curriculumItem.itemType);
    if (bucket) {
      bucket.push(item);
    } else if (__DEV__) {
      console.warn(
        `[queueBuilder] Skipping item ${item.srsState.itemId}: unknown type ${item.curriculumItem.itemType}`,
      );
    }
  }
  // Determine whether weakness bias is active.
  // Bias is enabled when weaknessBiasEnabled is true (or absent) AND weaknessScores is non-empty.
  const biasEnabled =
    options.weaknessBiasEnabled !== false &&
    options.weaknessScores !== undefined &&
    options.weaknessScores.size > 0;

  for (const bucket of buckets.values()) {
    if (biasEnabled) {
      // Within-bucket sort: priority DESC (higher priority first).
      // priority = WEAKNESS_WEIGHT × fsrsUrgency + WEAKNESS_BIAS_WEIGHT × weaknessScore
      // The boost from 5.4 acts as a lower-order tiebreak so reinforcement nudges survive.
      bucket.sort((a, b) => {
        const urgencyA = normalizeFsrsUrgency(a.srsState.dueDate, now);
        const urgencyB = normalizeFsrsUrgency(b.srsState.dueDate, now);
        const weaknessA = options.weaknessScores!.get(a.srsState.itemId) ?? 0;
        const weaknessB = options.weaknessScores!.get(b.srsState.itemId) ?? 0;
        const priorityA = computePriority(urgencyA, weaknessA, WEAKNESS_BIAS_WEIGHT, WEAKNESS_WEIGHT);
        const priorityB = computePriority(urgencyB, weaknessB, WEAKNESS_BIAS_WEIGHT, WEAKNESS_WEIGHT);
        if (priorityB !== priorityA) return priorityB - priorityA; // higher priority first
        // Tiebreak: boost (5.4 reinforcement nudge)
        return (b.boost ?? 0) - (a.boost ?? 0);
      });
    } else {
      // Bias disabled (or no weaknessScores): exact 5.1 due_date ASC + boost DESC ordering.
      bucket.sort((a, b) => {
        const dueCompare = a.srsState.dueDate.localeCompare(b.srsState.dueDate);
        if (dueCompare !== 0) return dueCompare;
        // Bounded within-bucket nudge: higher boost sorts ahead among equally-due items.
        return (b.boost ?? 0) - (a.boost ?? 0);
      });
    }
  }

  // Weighted round-robin
  const result: ReviewItem[] = [];
  const indices = new Map<ContentItemType, number>(TYPE_ORDER.map((type) => [type, 0]));
  let anyProgress = true;

  while (anyProgress) {
    anyProgress = false;
    for (const type of TYPE_ORDER) {
      const weight = INTERLEAVE_WEIGHTS[type];
      const bucket = buckets.get(type)!;
      const start = indices.get(type)!;
      const end = Math.min(start + weight, bucket.length);
      for (let i = start; i < end; i++) {
        const item = bucket[i];
        result.push(mapToReviewItem(item));
        anyProgress = true;
      }
      indices.set(type, end);
    }
  }

  if (options.limit !== undefined) {
    return result.slice(0, Math.max(0, options.limit));
  }
  return result;
}

function mapToReviewItem(item: QueueInputItem): ReviewItem {
  return {
    itemId: item.srsState.itemId,
    itemType: item.curriculumItem.itemType,
    primaryForm: item.curriculumItem.primaryForm,
    displayMeaning: item.curriculumItem.meaning,
    meanings: item.answerKey.acceptedMeanings,
    srsState: item.srsState,
    promptType: resolvePromptType(
      item.curriculumItem.itemType,
      item.srsState,
      item.curriculumItem.primaryForm,
    ),
    mnemonic: item.curriculumItem.mnemonicText,
    personalMnemonic: item.personalMnemonic ?? null,
    answerKey: item.answerKey,
    relatedItems: item.relatedItems ?? [],
    reinforcementLink: item.reinforcementLink ?? null,
  };
}
