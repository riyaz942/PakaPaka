import {
  LESSON_GRAMMAR_OPEN_MIN_VOCAB,
  LESSON_HEAVY_LOOKAHEAD,
  LESSON_HEAVY_PER_ITEMS,
  LESSON_VOCAB_OPEN_MIN_KANJI,
} from '@/config/constants';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';
import { GURU_PLUS } from '@/core/content/passageUnlock';
import type { SRSStageLabel } from '@/core/srs/srs.types';

import { isGrammarSlotOpen, type GrammarPace } from './grammarPace';
import { allocateTypeSlots, type MixBucket, type MixType } from './lessonMix';
import type { LessonWeight } from './lessonWeight';

export type LessonItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type LessonCandidate = {
  id: string;
  itemType: LessonItemType;
  primaryForm: string;
  meaning: string;
  sortOrder: number;
  /**
   * The learner asked for this item ahead of its level (opt-in unlock), so it
   * goes first in the lesson and keeps the started-parents rule (D13).
   *
   * Not a nicety: `sort_order` restarts at 1 per level *and* per type, so an
   * opted-in N3 kanji merged into an N5 pool would otherwise land wherever its
   * own level's numbering happens to put it. And a queue that quietly defers
   * what the learner just asked for is a queue they stop trusting.
   */
  optedIn?: boolean;
  /** D3: a lower-level radical or kanji pulled in because an active-level item needs it. */
  lowerLevelPart?: boolean;
  /** A grammar card read once and never reviewed: finishing it marks it known. */
  readOnce?: boolean;
  weight: LessonWeight;
  /** Lesson-only gate: kanji → radical component ids; vocabulary → `requires` kanji ids; else []. */
  gateParentIds: string[];
};

export type LessonLearnerContext = {
  kanjiStartedOrKnown: number;
  vocabStartedOrKnown: number;
  grammarPace: GrammarPace;
  dailyLessonItems: number;
};

export type LessonPlanInput = {
  candidates: LessonCandidate[];
  /** Study status per item id (known / in_progress); absent means not started. */
  studyStatuses: Map<string, ContentStudyStatus>;
  /** Item ids that already have an SRS state (imported or previously started). */
  startedItemIds: Set<string>;
  /** `requires` parents — today's review-safe rule. */
  parentsByItemId: Map<string, ContentParentItem[]>;
  /** Statuses of every `requires` and gate parent. */
  parentStatuses: Map<string, ContentStudyStatus>;
  /** Stored `srs_stage_label` of every `requires` and gate parent that has an SRS row. */
  parentStages: Map<string, SRSStageLabel>;
  learner: LessonLearnerContext;
  size: number;
  rng: () => number;
};

const TYPE_ORDER: readonly LessonItemType[] = ['radical', 'kanji', 'vocabulary', 'grammar'];
const MIX_TYPES: readonly MixType[] = ['radical', 'kanji', 'vocabulary'];

function isUnstarted(candidate: LessonCandidate, input: LessonPlanInput): boolean {
  const status = input.studyStatuses.get(candidate.id);
  return status !== 'known' && status !== 'in_progress' && !input.startedItemIds.has(candidate.id);
}

function passesStartedRule(candidate: LessonCandidate, input: LessonPlanInput): boolean {
  return isItemUnlocked(input.parentsByItemId.get(candidate.id) ?? [], input.parentStatuses);
}

function isKnownOrGuru(parentId: string, input: LessonPlanInput): boolean {
  if (input.parentStatuses.get(parentId) === 'known') return true;
  const stage = input.parentStages.get(parentId);
  return stage !== undefined && GURU_PLUS.has(stage);
}

/**
 * Lesson-only readiness (D1–D5, D13). Always at least as strict as the review
 * rule, so everything a lesson gives is also reviewable.
 */
export function isReadyToLearn(candidate: LessonCandidate, input: LessonPlanInput): boolean {
  if (!passesStartedRule(candidate, input)) return false;
  if (candidate.optedIn) return true;

  const gatesMet = () => candidate.gateParentIds.every((id) => isKnownOrGuru(id, input));
  switch (candidate.itemType) {
    case 'radical':
      return true;
    case 'kanji':
      return gatesMet();
    case 'vocabulary':
      return candidate.gateParentIds.length > 0
        ? gatesMet()
        : input.learner.kanjiStartedOrKnown >= LESSON_VOCAB_OPEN_MIN_KANJI;
    case 'grammar':
      return input.learner.vocabStartedOrKnown >= LESSON_GRAMMAR_OPEN_MIN_VOCAB;
  }
}

/** D11: any unstarted radical/kanji/word that passes `isItemUnlocked`. */
export function hasStartableItems(input: LessonPlanInput): boolean {
  return input.candidates.some(
    (candidate) =>
      candidate.itemType !== 'grammar' &&
      isUnstarted(candidate, input) &&
      passesStartedRule(candidate, input),
  );
}

function bySortKey(a: LessonCandidate, b: LessonCandidate): number {
  return (
    Number(b.optedIn ?? false) - Number(a.optedIn ?? false) ||
    Number(b.lowerLevelPart ?? false) - Number(a.lowerLevelPart ?? false) ||
    a.sortOrder - b.sortOrder
  );
}

function byTypeThenSortKey(a: LessonCandidate, b: LessonCandidate): number {
  return TYPE_ORDER.indexOf(a.itemType) - TYPE_ORDER.indexOf(b.itemType) || bySortKey(a, b);
}

/**
 * Picks today's lesson (spec §5): opt-ins first, at most one grammar when its
 * pace allows, then radical / kanji / vocabulary slots split by lead-weighted
 * shares with randomized rounding, with heavy items capped per lesson.
 */
export function planLesson(input: LessonPlanInput): LessonCandidate[] {
  const { size, learner } = input;
  if (size <= 0) return [];

  const unstarted = input.candidates.filter((candidate) => isUnstarted(candidate, input));
  const ready = unstarted.filter((candidate) => isReadyToLearn(candidate, input));

  const heavyCap = Math.max(1, Math.round(size / LESSON_HEAVY_PER_ITEMS));
  let heavy = 0;
  const take = (candidate: LessonCandidate, into: LessonCandidate[]) => {
    into.push(candidate);
    if (candidate.weight === 'heavy') heavy++;
  };

  const optIns: LessonCandidate[] = [];
  for (const candidate of ready.filter((item) => item.optedIn).sort(byTypeThenSortKey)) {
    if (optIns.length >= size) break;
    take(candidate, optIns);
  }

  const rest: LessonCandidate[] = [];
  const left = () => size - optIns.length - rest.length;

  const grammar = ready
    .filter((item) => item.itemType === 'grammar' && !item.optedIn)
    .sort(bySortKey)[0];
  if (
    grammar &&
    left() > 0 &&
    heavy < heavyCap &&
    isGrammarSlotOpen(learner.grammarPace, learner.dailyLessonItems)
  ) {
    take(grammar, rest);
  }

  const queues = new Map<MixType, LessonCandidate[]>(
    MIX_TYPES.map((type) => [
      type,
      ready.filter((item) => item.itemType === type && !item.optedIn).sort(bySortKey),
    ]),
  );
  const remaining = new Map<MixType, number>(
    MIX_TYPES.map((type) => [type, unstarted.filter((item) => item.itemType === type).length]),
  );

  while (left() > 0) {
    const buckets: MixBucket[] = MIX_TYPES.filter((type) => queues.get(type)!.length > 0).map(
      (type) => ({ type, available: queues.get(type)!.length, remaining: remaining.get(type)! }),
    );
    if (buckets.length === 0) break;

    const alloc = allocateTypeSlots(left(), buckets, input.rng);
    let took = 0;
    for (const type of MIX_TYPES) {
      const queue = queues.get(type)!;
      for (let n = 0; n < alloc[type]; n++) {
        const j = queue
          .slice(0, LESSON_HEAVY_LOOKAHEAD + 1)
          .findIndex((item) => item.weight !== 'heavy' || heavy < heavyCap);
        if (j < 0) {
          queue.length = 0;
          break;
        }
        take(queue.splice(j, 1)[0], rest);
        took++;
      }
    }
    if (took === 0) break;
  }

  return [...optIns, ...rest.sort(byTypeThenSortKey)];
}
