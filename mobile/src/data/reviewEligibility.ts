import type { SQLiteDatabase } from 'expo-sqlite';

import { normalizeKana } from '@/core/answer/readingEvaluator';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import { emitsTwoCards } from '@/core/srs/queueBuilder';
import {
  getKanjiReadings,
  getRequiredParentsForItems,
  listItemSummariesByIds,
} from '@/data/curriculum/itemRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { getUnlearnedKanjiForItems } from '@/data/user/masteryRepository';
import { getDueItemIds } from '@/data/user/srsStateRepository';

/**
 * The subset of `candidateIds` a review session would actually serve.
 *
 * Mirrors the queue's own filters (`useReviewQueue` + `queueBuilder`): the item
 * needs a curriculum row, its required parents must be started, and it must not
 * be marked `known`. A raw due-row count ignores all three, so Home could
 * promise "3 items ready" while the session served fewer (Plan 12.8).
 */
export function filterServableItemIds(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  candidateIds: string[],
): Set<string> {
  const servable = new Set<string>();
  if (candidateIds.length === 0) return servable;

  const withCurriculumRow = new Set(
    listItemSummariesByIds(curriculumDb, candidateIds).map((item) => item.id),
  );
  const parentsMap = getRequiredParentsForItems(curriculumDb, candidateIds);
  const parentIds = [
    ...new Set(
      Array.from(parentsMap.values())
        .flat()
        .map((parent) => parent.id),
    ),
  ];
  const parentStatuses = listStudyStatusesForItems(userDb, parentIds);
  const studyStatuses = listStudyStatusesForItems(userDb, candidateIds);

  for (const itemId of candidateIds) {
    if (!withCurriculumRow.has(itemId)) continue;
    if (studyStatuses.get(itemId) === 'known') continue;
    if (!isItemUnlocked(parentsMap.get(itemId) ?? [], parentStatuses)) continue;
    servable.add(itemId);
  }

  return servable;
}

/** Home's "N items ready" — due rows the session can actually hand back. */
export function countServableDueItems(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  now: Date = new Date(),
): number {
  return filterServableItemIds(curriculumDb, userDb, getDueItemIds(userDb, now)).size;
}

/**
 * Home's review count, in the unit the session header counts: cards. An item
 * the session asks twice (meaning + reading, or grammar Read + Build) counts
 * as two, with the same rule the queue builder uses (`emitsTwoCards`).
 */
export function countServableDueCards(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  now: Date = new Date(),
): number {
  const servableIds = [
    ...filterServableItemIds(curriculumDb, userDb, getDueItemIds(userDb, now)),
  ];
  if (servableIds.length === 0) return 0;

  const unlearnedKanji = getUnlearnedKanjiForItems(userDb, servableIds);
  let cards = 0;
  for (const item of listItemSummariesByIds(curriculumDb, servableIds)) {
    const twoCards = emitsTwoCards({
      itemType: item.itemType,
      primaryForm: item.primaryForm,
      // Same check as the queue's answer key: an on'yomi row with kana in it.
      kanjiHasOnyomi:
        item.itemType === 'kanji' &&
        getKanjiReadings(curriculumDb, item.id).some(
          (reading) =>
            reading.readingType === 'onyomi' && normalizeKana(reading.reading).length > 0,
        ),
      unlearnedKanji: unlearnedKanji.get(item.id),
    });
    cards += twoCards ? 2 : 1;
  }
  return cards;
}
