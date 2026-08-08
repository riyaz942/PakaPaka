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

/** One tested level and the ids the self-check resolved as known inside it. */
export type PlacementLevelKnownIds = {
  level: JLPTLevel;
  knownIds: string[];
};

export type PlacementResult = {
  lowerLevelCount: number;
  withinLevelCounts: { level: JLPTLevel; count: number }[];
};

/**
 * Applies a placement outcome across the tested range: everything below the
 * *lowest* tested level is treated as known (prerequisite for the dependency
 * graph to unlock level content), plus each tested level's own ids resolved
 * from the self-check. A single-level range is a list of length one.
 */
export function applyPlacement(
  userDb: SQLiteDatabase,
  curriculumDb: SQLiteDatabase,
  testedLevels: PlacementLevelKnownIds[],
): PlacementResult {
  const tested = new Set(testedLevels.map((entry) => entry.level));
  const lowestTested = JLPT_LEVELS.find((level) => tested.has(level));
  const lowerLevelIds = lowestTested
    ? listItemIdsForLevels(curriculumDb, levelsBelow(lowestTested))
    : [];

  const lower = bulkSetStudyStatusKnown(userDb, lowerLevelIds);

  const withinLevelCounts: PlacementResult['withinLevelCounts'] = [];
  for (const { level, knownIds } of testedLevels) {
    const written = bulkSetStudyStatusKnown(userDb, knownIds);
    withinLevelCounts.push({ level, count: written.updatedCount });
  }

  return { lowerLevelCount: lower.updatedCount, withinLevelCounts };
}
