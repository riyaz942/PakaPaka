import type { SQLiteDatabase } from 'expo-sqlite';

import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  ITEM_TYPES,
  listItemsByLevelAndType,
} from '@/data/curriculum/itemRepository';
import { bulkSetStudyStatusKnown } from '@/data/user/itemStudyStatusRepository';

/** Levels easier than the given one (N3 → [N5, N4]). */
export function levelsBelow(level: JLPTLevel): JLPTLevel[] {
  const index = JLPT_LEVELS.indexOf(level);
  return JLPT_LEVELS.slice(0, Math.max(0, index));
}

export function listItemIdsForLevels(
  curriculumDb: SQLiteDatabase,
  levels: JLPTLevel[],
): string[] {
  const ids: string[] = [];
  for (const level of levels) {
    for (const itemType of ITEM_TYPES) {
      for (const item of listItemsByLevelAndType(curriculumDb, level, itemType)) {
        ids.push(item.id);
      }
    }
  }
  return ids;
}

export type PlacementResult = {
  lowerLevelCount: number;
  withinLevelCount: number;
};

/**
 * Applies a placement outcome: everything below the starting level is treated
 * as known (prerequisite for the dependency graph to unlock level content),
 * plus the within-level ids resolved from the self-check.
 */
export function applyPlacement(
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
  level: JLPTLevel,
  withinLevelKnownIds: string[],
): PlacementResult {
  const lowerLevelIds = listItemIdsForLevels(curriculumDb, levelsBelow(level));

  const lower = bulkSetStudyStatusKnown(userDb, lowerLevelIds);
  const within = bulkSetStudyStatusKnown(userDb, withinLevelKnownIds);

  return {
    lowerLevelCount: lower.updatedCount,
    withinLevelCount: within.updatedCount,
  };
}
