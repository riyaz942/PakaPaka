import { INTERLEAVE_WEIGHTS as CONFIG_INTERLEAVE_WEIGHTS } from '@/config/constants';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type { ContentItemSummary, ContentItemType, ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';

import { resolvePromptType } from './promptResolver';
import type { ReviewItem, QueueBuildOptions, SRSState, ReviewAnswerKey } from './srs.types';

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
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.srsState.dueDate.localeCompare(b.srsState.dueDate));
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
    meanings: [item.curriculumItem.meaning],
    srsState: item.srsState,
    promptType: resolvePromptType(item.curriculumItem.itemType, item.srsState),
    mnemonic: item.curriculumItem.mnemonicText,
    personalMnemonic: item.personalMnemonic ?? null,
    answerKey: item.answerKey,
  };
}
