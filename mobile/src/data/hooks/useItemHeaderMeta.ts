import { useMemo } from 'react';

import type { SRSStageLabel } from '@/core/srs/srs.types';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { getItemById } from '@/data/curriculum/itemRepository';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getSrsState } from '@/data/user/srsStateRepository';

export type ItemHeaderMeta = {
  itemType: ItemType | null;
  jlptLevel: JLPTLevel | null;
  /** `null` until the item has an SRS row — i.e. it has never been taught. */
  srsStage: SRSStageLabel | null;
};

/**
 * The facts the detail header bar needs — type badge, JLPT level and SRS stage pill.
 *
 * Read here rather than lifted out of `useItemDetail` because the bar sits
 * outside the scroll, above `ItemDetailBody`, on both detail surfaces. Two
 * primary-key lookups against already-open handles is cheaper than threading
 * the whole detail result through two screens. Display only: neither value
 * feeds selection, ordering or scheduling.
 */
export function useItemHeaderMeta(itemId: string | null): ItemHeaderMeta {
  const { curriculumDb, userDb } = useDatabase();

  return useMemo(() => {
    if (!itemId) {
      return { itemType: null, jlptLevel: null, srsStage: null };
    }
    const item = getItemById(curriculumDb, itemId);
    return {
      itemType: item?.itemType ?? null,
      jlptLevel: item?.jlptLevel ?? null,
      srsStage: getSrsState(userDb, itemId)?.srsStageLabel ?? null,
    };
  }, [curriculumDb, userDb, itemId]);
}
