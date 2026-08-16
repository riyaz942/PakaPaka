import { useCallback, useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import { computeDailyAllowance, type DailyAllowance } from '@/core/lesson/lessonAllowance';
import {
  lessonSizeForIntensity,
  planLesson,
  type LessonCandidate,
} from '@/core/lesson/lessonPlanner';
import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  getRequiredParentsForItems,
  listLessonCandidatePool,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { getLessonItemsStartedOn } from '@/data/user/lessonProgressRepository';
import {
  getSessionIntensity,
  getStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { getDueSrsStates, getSrsStatesForItems } from '@/data/user/srsStateRepository';
import { isVacationActive } from '@/data/user/vacationRepository';

export type LessonPlan = {
  items: LessonCandidate[];
  /** Level the lesson draws from — advances past the starting level once it is exhausted. */
  level: JLPTLevel | null;
  size: number;
  /** Today's lesson allowance (advisory daily cap on new items). */
  allowance: DailyAllowance;
  /**
   * True when new items exist but the daily allowance blocks them — distinct
   * from items being empty because nothing new is available.
   */
  capReached: boolean;
};

const EMPTY_ALLOWANCE: DailyAllowance = { total: 0, remaining: 0 };

function buildPlanForLevel(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  level: JLPTLevel,
  size: number,
): LessonCandidate[] {
  // The level's items *plus* their transitive required parents, wherever those
  // are taught: an N5 learner is offered 写 and 真 before 写真, even though both
  // kanji are N3. The pulled-forward items keep their own JLPT level in Browse,
  // filters and item detail — only the lesson sequence moves.
  const candidates: LessonCandidate[] = listLessonCandidatePool(curriculumDb, level).map(
    (item) => ({
      id: item.id,
      itemType: item.itemType,
      primaryForm: item.primaryForm,
      meaning: item.meaning,
      sortOrder: item.sortOrder,
    }),
  );

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const studyStatuses = listStudyStatusesForItems(userDb, candidateIds);
  const startedItemIds = new Set(getSrsStatesForItems(userDb, candidateIds).keys());

  const parentsByItemId = getRequiredParentsForItems(curriculumDb, candidateIds);
  const parentIds = [
    ...new Set([...parentsByItemId.values()].flat().map((parent) => parent.id)),
  ];
  const parentStatuses = listStudyStatusesForItems(userDb, parentIds);

  return planLesson({
    candidates,
    studyStatuses,
    startedItemIds,
    parentsByItemId,
    parentStatuses,
    size,
  });
}

export type UseLessonPlanOptions = {
  /** Bypass the daily allowance ("Learn anyway"). The cap is advisory, not a hard block. */
  ignoreAllowance?: boolean;
};

/**
 * Auto-generates today's lesson from the user's level, session intensity, and
 * dependency graph. When the starting level runs out of new items, the plan
 * advances to the next harder level automatically.
 *
 * The batch is clamped to the remaining daily allowance so repeated visits
 * can't binge the whole curriculum in one evening.
 */
export function useLessonPlan(
  options: UseLessonPlanOptions = {},
): LessonPlan & { isLoading: boolean; refetch: () => void } {
  const { ignoreAllowance = false } = options;
  const { curriculumDb, userDb } = useDatabase();
  const [plan, setPlan] = useState<LessonPlan>({
    items: [],
    level: null,
    size: 0,
    allowance: EMPTY_ALLOWANCE,
    capReached: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      // Vacation mode pauses lessons as well as reviews. Home hides the entry
      // point; this covers deep links straight into /lesson.
      if (isVacationActive(userDb)) {
        setPlan({
          items: [],
          level: null,
          size: 0,
          allowance: EMPTY_ALLOWANCE,
          capReached: false,
        });
        return;
      }

      const startingLevel = getStartingJlptLevel(userDb) ?? 'N5';
      const intensity = getSessionIntensity(userDb);
      const size = lessonSizeForIntensity(intensity);

      const allowance = computeDailyAllowance({
        intensity,
        itemsStartedToday: getLessonItemsStartedOn(userDb, todayKey()),
        reviewsDueCount: getDueSrsStates(userDb).length,
      });
      const effectiveSize = ignoreAllowance
        ? size
        : Math.min(size, allowance.remaining);

      const startIndex = Math.max(0, JLPT_LEVELS.indexOf(startingLevel));
      let resolvedLevel: JLPTLevel = startingLevel;
      let items: LessonCandidate[] = [];

      // Plan with the full batch size to learn whether new items exist at all,
      // then re-plan at the clamped size so type interleaving stays correct.
      for (let i = startIndex; i < JLPT_LEVELS.length; i++) {
        const level = JLPT_LEVELS[i];
        items = buildPlanForLevel(curriculumDb, userDb, level, size);
        resolvedLevel = level;
        if (items.length > 0) {
          break;
        }
      }

      const capReached = items.length > 0 && effectiveSize < Math.min(size, items.length);
      if (effectiveSize < size) {
        items =
          effectiveSize > 0
            ? buildPlanForLevel(curriculumDb, userDb, resolvedLevel, effectiveSize)
            : [];
      }

      setPlan({ items, level: resolvedLevel, size, allowance, capReached });
    } catch {
      setPlan({
        items: [],
        level: null,
        size: 0,
        allowance: EMPTY_ALLOWANCE,
        capReached: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount, ignoreAllowance]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { ...plan, isLoading, refetch };
}
