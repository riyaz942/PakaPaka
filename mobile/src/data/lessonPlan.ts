import type { SQLiteDatabase } from 'expo-sqlite';

import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';
import { summarizeGrammarStarts } from '@/core/lesson/grammarPace';
import { computeDailyAllowance, type DailyAllowance } from '@/core/lesson/lessonAllowance';
import {
  hasStartableItems,
  planLesson,
  type LessonCandidate,
  type LessonLearnerContext,
  type LessonPlanInput,
} from '@/core/lesson/lessonPlanner';
import { lessonWeight } from '@/core/lesson/lessonWeight';
import type { SRSStageLabel } from '@/core/srs/srs.types';
import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  getOptInPoolForItems,
  getRadicalComponentsForItems,
  getRequiredParentsForItems,
  getVocabularyWeightFacts,
  listItemsByLevelAndType,
  listItemSummariesByIds,
  listLessonCandidatePool,
  type CurriculumListItem,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import {
  countStartedOrKnownItems,
  listGrammarStarts,
} from '@/data/user/lessonLearnerRepository';
import { listLessonOptInIds } from '@/data/user/lessonOptInRepository';
import { getLessonItemsStartedOn } from '@/data/user/lessonProgressRepository';
import {
  getDailyLessonItems,
  getLessonItemCount,
  getStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { getDueSrsStates, getSrsStatesForItems } from '@/data/user/srsStateRepository';
import { isVacationActive } from '@/data/user/vacationRepository';
import { createSeededRng } from '@/utils/seededRng';

export type LessonPlan = {
  items: LessonCandidate[];
  /** Radical/kanji/vocabulary level — advances once the level has nothing startable left. */
  level: JLPTLevel | null;
  /** D17: lowest level ≥ the starting level with unstarted grammar. */
  grammarLevel: JLPTLevel | null;
  size: number;
  /** Today's lesson allowance (advisory daily cap on new items). */
  allowance: DailyAllowance;
  /**
   * True when new items exist but the daily allowance blocks them — distinct
   * from items being empty because nothing new is available.
   */
  capReached: boolean;
  /** Startable radicals/kanji/words exist but none is ready (waiting on Guru). */
  waiting: boolean;
};

export type BuildLessonPlanOptions = {
  /** Bypass the daily allowance ("Learn anyway"). The cap is advisory, not a hard block. */
  ignoreAllowance?: boolean;
  now?: Date;
  /** Plan this many items instead of the Settings lesson size. */
  sizeOverride?: number;
};

const EMPTY_ALLOWANCE: DailyAllowance = { total: 0, remaining: 0 };

export const EMPTY_LESSON_PLAN: LessonPlan = {
  items: [],
  level: null,
  grammarLevel: null,
  size: 0,
  allowance: EMPTY_ALLOWANCE,
  capReached: false,
  waiting: false,
};

type PoolEntry = { item: CurriculumListItem; optedIn: boolean; lowerLevelPart: boolean };

function idsOfType(curriculumDb: SQLiteDatabase, itemType: ItemType): string[] {
  return JLPT_LEVELS.flatMap((level) =>
    listItemsByLevelAndType(curriculumDb, level, itemType).map((item) => item.id),
  );
}

function isUnstarted(
  itemId: string,
  statuses: Map<string, ContentStudyStatus>,
  startedIds: Set<string>,
): boolean {
  const status = statuses.get(itemId);
  return status !== 'known' && status !== 'in_progress' && !startedIds.has(itemId);
}

/** Item ids among `itemIds` with no SRS row and no in_progress / known status. */
function unstartedIds(userDb: SQLiteDatabase, itemIds: string[]): string[] {
  const statuses = listStudyStatusesForItems(userDb, itemIds);
  const startedIds = new Set(getSrsStatesForItems(userDb, itemIds).keys());
  return itemIds.filter((id) => isUnstarted(id, statuses, startedIds));
}

/** D17: grammar comes from the lowest level ≥ the starting level that has unstarted grammar. */
function resolveGrammarLevel(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  levels: readonly JLPTLevel[],
): { grammarLevel: JLPTLevel | null; grammar: CurriculumListItem[] } {
  for (const level of levels) {
    const grammar = listItemsByLevelAndType(curriculumDb, level, 'grammar');
    if (unstartedIds(userDb, grammar.map((item) => item.id)).length > 0) {
      return { grammarLevel: level, grammar };
    }
  }
  return { grammarLevel: null, grammar: [] };
}

/**
 * D3: radicals and kanji below the level that a level kanji or word needs and
 * the learner has not started or marked known — with the radicals those kanji
 * need in turn. Nothing else from a lower level comes back.
 */
function lowerLevelParts(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  levelPool: CurriculumListItem[],
): CurriculumListItem[] {
  const inPool = new Set(levelPool.map((item) => item.id));
  const outside = (parents: Map<string, ContentParentItem[]>) => [
    ...new Set(
      [...parents.values()]
        .flat()
        .map((parent) => parent.id)
        .filter((id) => !inPool.has(id)),
    ),
  ];

  const poolKanji = levelPool.filter((item) => item.itemType === 'kanji').map((item) => item.id);
  const poolWords = levelPool
    .filter((item) => item.itemType === 'vocabulary')
    .map((item) => item.id);
  const kanjiParts = unstartedIds(
    userDb,
    outside(getRequiredParentsForItems(curriculumDb, poolWords)),
  );
  const radicalParts = unstartedIds(userDb, [
    ...new Set([
      ...outside(getRadicalComponentsForItems(curriculumDb, poolKanji)),
      ...outside(getRadicalComponentsForItems(curriculumDb, kanjiParts)),
    ]),
  ]);
  return listItemSummariesByIds(curriculumDb, [...radicalParts, ...kanjiParts]);
}

function buildInputForLevel(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  level: JLPTLevel,
  grammar: CurriculumListItem[],
  optInIds: string[],
  learner: LessonLearnerContext,
  size: number,
): LessonPlanInput {
  const levelPool = listLessonCandidatePool(curriculumDb, level).filter(
    (item) => item.itemType !== 'grammar',
  );
  const pool: PoolEntry[] = [
    ...levelPool.map((item) => ({ item, optedIn: false, lowerLevelPart: false })),
    ...lowerLevelParts(curriculumDb, userDb, levelPool).map((item) => ({
      item,
      optedIn: false,
      lowerLevelPart: true,
    })),
    // The items this learner asked for ahead of their level, and everything
    // those are built from. They keep their own JLPT level in Browse and
    // detail; only the lesson sequence moves.
    ...getOptInPoolForItems(curriculumDb, optInIds).map((item) => ({
      item,
      optedIn: true,
      lowerLevelPart: false,
    })),
    ...grammar.map((item) => ({ item, optedIn: false, lowerLevelPart: false })),
  ];

  // Deduplicated by id, first wins: an opt-in the learner has since caught up
  // to is already in the level pool.
  const seen = new Set<string>();
  const entries = pool.filter(({ item }) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const candidateIds = entries.map(({ item }) => item.id);

  const parentsByItemId = getRequiredParentsForItems(curriculumDb, candidateIds);
  const radicalComponents = getRadicalComponentsForItems(
    curriculumDb,
    entries.filter(({ item }) => item.itemType === 'kanji').map(({ item }) => item.id),
  );
  const vocabFacts = getVocabularyWeightFacts(
    curriculumDb,
    entries.filter(({ item }) => item.itemType === 'vocabulary').map(({ item }) => item.id),
  );

  const candidates: LessonCandidate[] = entries.map(({ item, optedIn, lowerLevelPart }) => {
    const components = radicalComponents.get(item.id) ?? [];
    const facts = vocabFacts.get(item.id);
    const gateParents =
      item.itemType === 'kanji'
        ? components
        : item.itemType === 'vocabulary'
          ? (parentsByItemId.get(item.id) ?? []).filter((parent) => parent.itemType === 'kanji')
          : [];
    return {
      id: item.id,
      itemType: item.itemType,
      primaryForm: item.primaryForm,
      meaning: item.meaning,
      sortOrder: item.sortOrder,
      optedIn,
      lowerLevelPart,
      weight: lessonWeight({
        itemType: item.itemType,
        radicalComponentCount: components.length,
        readingComposition: facts?.readingComposition,
        wordType: facts?.wordType,
      }),
      gateParentIds: gateParents.map((parent) => parent.id),
    };
  });

  const parentIds = [
    ...new Set([
      ...[...parentsByItemId.values()].flat().map((parent) => parent.id),
      ...candidates.flatMap((candidate) => candidate.gateParentIds),
    ]),
  ];
  const parentStages = new Map<string, SRSStageLabel>();
  for (const [id, state] of getSrsStatesForItems(userDb, parentIds)) {
    parentStages.set(id, state.srsStageLabel);
  }

  return {
    candidates,
    studyStatuses: listStudyStatusesForItems(userDb, candidateIds),
    startedItemIds: new Set(getSrsStatesForItems(userDb, candidateIds).keys()),
    parentsByItemId,
    parentStatuses: listStudyStatusesForItems(userDb, parentIds),
    parentStages,
    learner,
    size,
    rng: Math.random,
  };
}

/**
 * Today's lesson from the learner's level, lesson size and readiness gates
 * (spec 2026-10-24-lesson-mix §5). Radicals, kanji and words advance a level
 * only when the level has nothing startable left (D11); grammar runs on its own
 * level track (D17). The batch is clamped to the remaining daily allowance.
 */
export function buildLessonPlan(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  options: BuildLessonPlanOptions = {},
): LessonPlan {
  const { ignoreAllowance = false, now = new Date(), sizeOverride } = options;

  // Vacation mode pauses lessons as well as reviews. Home hides the entry
  // point; this covers deep links straight into /lesson.
  if (isVacationActive(userDb)) {
    return EMPTY_LESSON_PLAN;
  }

  const startingLevel = getStartingJlptLevel(userDb) ?? 'N5';
  const size = sizeOverride ?? getLessonItemCount(userDb);
  const dailyLessonItems = getDailyLessonItems(userDb);
  const itemsStartedToday = getLessonItemsStartedOn(userDb, todayKey(now));

  const allowance = computeDailyAllowance({
    dailyLessonItems,
    itemsPerLesson: size,
    itemsStartedToday,
    reviewsDueCount: getDueSrsStates(userDb, now).length,
  });
  const effectiveSize = ignoreAllowance ? size : Math.min(size, allowance.remaining);

  const learner: LessonLearnerContext = {
    kanjiStartedOrKnown: countStartedOrKnownItems(userDb, idsOfType(curriculumDb, 'kanji')),
    vocabStartedOrKnown: countStartedOrKnownItems(userDb, idsOfType(curriculumDb, 'vocabulary')),
    grammarPace: summarizeGrammarStarts(
      listGrammarStarts(userDb, idsOfType(curriculumDb, 'grammar')),
      now,
    ),
    dailyLessonItems,
  };

  const levels = JLPT_LEVELS.slice(Math.max(0, JLPT_LEVELS.indexOf(startingLevel)));
  const { grammarLevel, grammar } = resolveGrammarLevel(curriculumDb, userDb, levels);
  const optInIds = listLessonOptInIds(userDb);

  let level: JLPTLevel = levels[levels.length - 1];
  let input: LessonPlanInput | null = null;
  for (const candidateLevel of levels) {
    level = candidateLevel;
    input = buildInputForLevel(curriculumDb, userDb, level, grammar, optInIds, learner, size);
    if (hasStartableItems(input)) break;
  }
  if (input === null) {
    return { ...EMPTY_LESSON_PLAN, allowance, size };
  }
  const chosen = input;

  // A fresh rng per call, seeded by the local day and today's progress, so a
  // re-mount and the clamped re-plan return the same lesson (D14).
  const plan = (lessonSize: number) =>
    planLesson({
      ...chosen,
      size: lessonSize,
      rng: createSeededRng(`${todayKey(now)}:${itemsStartedToday}`),
    });

  // Plan with the full batch size to learn whether new items exist at all,
  // then re-plan at the clamped size so the type mix stays correct.
  const full = plan(size);
  const items = effectiveSize < size ? (effectiveSize > 0 ? plan(effectiveSize) : []) : full;
  const capReached = full.length > 0 && effectiveSize < Math.min(size, full.length);
  const waiting = hasStartableItems(chosen) && !full.some((item) => item.itemType !== 'grammar');

  return { items, level, grammarLevel, size, allowance, capReached, waiting };
}
