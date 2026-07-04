import { useCallback, useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  lessonSizeForIntensity,
  planLesson,
  type LessonCandidate,
} from '@/core/lesson/lessonPlanner';
import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  ITEM_TYPES,
  getRequiredParentsForItems,
  listItemsByLevelAndType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import {
  getSessionIntensity,
  getStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';

export type LessonPlan = {
  items: LessonCandidate[];
  /** Level the lesson draws from — advances past the starting level once it is exhausted. */
  level: JLPTLevel | null;
  size: number;
};

function buildPlanForLevel(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  level: JLPTLevel,
  size: number,
): LessonCandidate[] {
  const candidates: LessonCandidate[] = [];
  for (const itemType of ITEM_TYPES) {
    for (const item of listItemsByLevelAndType(curriculumDb, level, itemType)) {
      candidates.push({
        id: item.id,
        itemType: item.itemType,
        primaryForm: item.primaryForm,
        meaning: item.meaning,
        sortOrder: item.sortOrder,
      });
    }
  }

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

/**
 * Auto-generates today's lesson from the user's level, session intensity, and
 * dependency graph. When the starting level runs out of new items, the plan
 * advances to the next harder level automatically.
 */
export function useLessonPlan(): LessonPlan & { isLoading: boolean; refetch: () => void } {
  const { curriculumDb, userDb } = useDatabase();
  const [plan, setPlan] = useState<LessonPlan>({ items: [], level: null, size: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      const startingLevel = getStartingJlptLevel(userDb) ?? 'N5';
      const size = lessonSizeForIntensity(getSessionIntensity(userDb));

      const startIndex = Math.max(0, JLPT_LEVELS.indexOf(startingLevel));
      let resolvedLevel: JLPTLevel = startingLevel;
      let items: LessonCandidate[] = [];

      for (let i = startIndex; i < JLPT_LEVELS.length; i++) {
        const level = JLPT_LEVELS[i];
        items = buildPlanForLevel(curriculumDb, userDb, level, size);
        resolvedLevel = level;
        if (items.length > 0) {
          break;
        }
      }

      setPlan({ items, level: resolvedLevel, size });
    } catch {
      setPlan({ items: [], level: null, size: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { ...plan, isLoading, refetch };
}
