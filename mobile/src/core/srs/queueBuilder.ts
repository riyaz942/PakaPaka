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

import { isVocabularyReadingUnlocked, resolvePromptType } from './promptResolver';
import type { GrammarSentenceCard, ReviewItem, QueueBuildOptions, SRSState, ReviewAnswerKey } from './srs.types';
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
  /** Grammar pair payloads (spec §5.3); grammar only. */
  grammarRead?: GrammarSentenceCard;
  grammarBuild?: GrammarSentenceCard;
  /**
   * True when a kanji item has at least one on'yomi row — it is emitted as a
   * two-card pair (meaning + on'yomi reading). Kanji without on'yomi get a
   * meaning card only. Ignored for non-kanji types.
   */
  kanjiHasOnyomi?: boolean;
  /**
   * Kanji written in this vocabulary item that the learner has not reached guru
   * on (v2 rule 1). Empty/absent means the reading card is live, so the word is
   * emitted as a two-card pair like kanji. Ignored for non-vocabulary types.
   */
  unlearnedKanji?: string[];
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
  const dueExempt = options.dueExemptItemIds;
  const eligible = items.filter((item) => {
    if (item.srsState.isBurned) return false;
    if (item.studyStatus === 'known') return false;
    if (!isItemUnlocked(item.parents, item.parentStatuses)) return false;
    if (item.srsState.dueDate > nowIso && !dueExempt?.has(item.srsState.itemId)) return false;
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

  // Weighted round-robin over items (a two-card kanji still occupies one slot
  // in the rotation — expansion into cards happens below).
  const ordered: QueueInputItem[] = [];
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
        ordered.push(bucket[i]);
        anyProgress = true;
      }
      indices.set(type, end);
    }
  }

  // Two-card expansion (Story 1.1, extended by v2 rule 2): each kanji with
  // on'yomi becomes a meaning card plus an on'yomi reading card, and so does
  // each vocabulary item whose kanji are all learned; each grammar item becomes
  // a Read (meaning) card plus a Build (production) card. The second card is
  // deferred at least PAIR_MIN_GAP cards so the pair never lands back-to-back
  // unless the queue is too short to allow it.
  const result: ReviewItem[] = [];
  const pendingSecondCards: { earliestIndex: number; card: ReviewItem }[] = [];
  const flushReadySecondCards = () => {
    while (
      pendingSecondCards.length > 0 &&
      pendingSecondCards[0].earliestIndex <= result.length
    ) {
      result.push(pendingSecondCards.shift()!.card);
    }
  };
  for (const input of ordered) {
    flushReadySecondCards();
    if (isTwoCardInput(input)) {
      result.push(mapToReviewItem(input, { promptType: 'meaning', isTwoCardItem: true }));
      pendingSecondCards.push({
        earliestIndex: result.length + PAIR_MIN_GAP,
        card: mapToReviewItem(input, {
          promptType: input.curriculumItem.itemType === 'grammar' ? 'production' : 'reading',
          isTwoCardItem: true,
        }),
      });
    } else {
      result.push(mapToReviewItem(input));
    }
    flushReadySecondCards();
  }
  while (pendingSecondCards.length > 0) {
    result.push(pendingSecondCards.shift()!.card);
  }

  if (options.limit !== undefined) {
    return applyQueueLimit(result, options.limit);
  }
  return result;
}

/**
 * Truncate the card queue without splitting a two-card kanji pair. When the
 * cut would orphan a meaning or reading card, pull its partner in (may exceed
 * `limit` by one). If the partner is somehow absent, demote the orphan so it
 * grades as a single-card item instead of blocking FSRS forever.
 */
function applyQueueLimit(items: ReviewItem[], limit: number): ReviewItem[] {
  if (limit <= 0) return [];
  let sliced = items.slice(0, limit);

  const incompleteIds: string[] = [];
  for (const card of sliced) {
    if (!card.isTwoCardItem) continue;
    if (incompleteIds.includes(card.itemId)) continue;
    const hasPartner = sliced.some(
      (other) =>
        other.itemId === card.itemId &&
        other.isTwoCardItem &&
        other.promptType !== card.promptType,
    );
    if (!hasPartner) incompleteIds.push(card.itemId);
  }

  for (const itemId of incompleteIds) {
    const orphan = sliced.find((c) => c.itemId === itemId && c.isTwoCardItem)!;
    const partner = items.find(
      (c) =>
        c.itemId === itemId &&
        c.isTwoCardItem &&
        c.promptType !== orphan.promptType,
    );
    const partnerAlreadyInSlice =
      partner !== undefined &&
      sliced.some(
        (c) => c.itemId === itemId && c.promptType === partner.promptType,
      );
    if (partner && !partnerAlreadyInSlice) {
      sliced = [...sliced, partner];
    } else if (!partner) {
      sliced = sliced.map((c) =>
        c.itemId === itemId && c.isTwoCardItem
          ? { ...c, isTwoCardItem: undefined }
          : c,
      );
    }
  }

  return sliced;
}

/** Minimum other cards between an item's meaning card and its reading card. */
export const PAIR_MIN_GAP = 2;

/**
 * Which items emit both a meaning and a reading card: kanji that have an
 * on'yomi to ask for, and vocabulary whose every kanji has reached guru.
 * Every grammar item is a Read + Build pair at every stage (D1, D7).
 */
function isTwoCardInput(item: QueueInputItem): boolean {
  if (item.curriculumItem.itemType === 'grammar') return true;
  if (item.curriculumItem.itemType === 'kanji') return item.kanjiHasOnyomi === true;
  if (item.curriculumItem.itemType === 'vocabulary') {
    return isVocabularyReadingUnlocked(
      item.curriculumItem.primaryForm,
      item.unlearnedKanji ?? [],
    );
  }
  return false;
}

function mapToReviewItem(
  item: QueueInputItem,
  overrides?: { promptType: ReviewItem['promptType']; isTwoCardItem: boolean },
): ReviewItem {
  // v2 rule 3: a word still waiting on its kanji is capped at master, and the
  // card says which kanji it is waiting for.
  const readingLockedBy =
    item.curriculumItem.itemType === 'vocabulary' && item.unlearnedKanji?.length
      ? item.unlearnedKanji
      : undefined;

  return {
    itemId: item.srsState.itemId,
    itemType: item.curriculumItem.itemType,
    primaryForm: item.curriculumItem.primaryForm,
    furigana: item.curriculumItem.furigana ?? null,
    displayMeaning: item.curriculumItem.meaning,
    meanings: item.answerKey.acceptedMeanings,
    srsState: item.srsState,
    promptType: overrides?.promptType ?? resolvePromptType(item.curriculumItem.itemType),
    isTwoCardItem: overrides?.isTwoCardItem,
    grammarRead: item.grammarRead,
    grammarBuild: item.grammarBuild,
    readingLocked: readingLockedBy !== undefined,
    readingLockedBy,
    mnemonic: item.curriculumItem.mnemonicText,
    personalMnemonic: item.personalMnemonic ?? null,
    answerKey: item.answerKey,
    relatedItems: item.relatedItems ?? [],
    reinforcementLink: item.reinforcementLink ?? null,
  };
}
