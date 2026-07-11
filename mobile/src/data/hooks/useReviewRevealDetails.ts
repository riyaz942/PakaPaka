import { useCallback, useEffect, useRef } from 'react';

import type { ReviewItem } from '@/core/srs/srs.types';
import {
  getExampleSentences,
  getItemById,
  getKanjiReadings,
  type CurriculumItemDetail,
  type ExampleSentence,
  type KanjiReading,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export type ReviewRevealDetail = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  exampleSentences: ExampleSentence[];
};

/**
 * Prefetches full item detail for the current review item and the lookahead
 * buffer so the incorrect reveal is a pure render — no DB round-trip may sit
 * on the <100ms answer-feedback critical path.
 */
export function useReviewRevealDetails(
  currentItem: ReviewItem | null,
  prefetchBuffer: ReviewItem[],
): (itemId: string) => ReviewRevealDetail | null {
  const { curriculumDb } = useDatabase();
  const cacheRef = useRef(new Map<string, ReviewRevealDetail>());

  useEffect(() => {
    const cache = cacheRef.current;
    const items = currentItem ? [currentItem, ...prefetchBuffer] : prefetchBuffer;
    for (const reviewItem of items) {
      if (cache.has(reviewItem.itemId)) continue;
      const detail = getItemById(curriculumDb, reviewItem.itemId);
      if (!detail) continue;
      cache.set(reviewItem.itemId, {
        item: detail,
        kanjiReadings:
          detail.itemType === 'kanji' ? getKanjiReadings(curriculumDb, reviewItem.itemId) : [],
        exampleSentences: getExampleSentences(curriculumDb, reviewItem.itemId),
      });
    }
  }, [curriculumDb, currentItem, prefetchBuffer]);

  return useCallback((itemId: string) => cacheRef.current.get(itemId) ?? null, []);
}
