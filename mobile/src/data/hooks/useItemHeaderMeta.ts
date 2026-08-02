import { useMemo } from 'react';

import type { SRSStageLabel } from '@/core/srs/srs.types';
import { getItemById } from '@/data/curriculum/itemRepository';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getSrsState } from '@/data/user/srsStateRepository';

export type ItemHeaderMeta = {
  itemType: ItemType | null;
  /** `null` until the item has an SRS row — i.e. it has never been taught. */
  srsStage: SRSStageLabel | null;
};

/**
 * The two facts the detail header bar needs — type badge and SRS stage pill.
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
      return { itemType: null, srsStage: null };
    }
    return {
      itemType: getItemById(curriculumDb, itemId)?.itemType ?? null,
      srsStage: getSrsState(userDb, itemId)?.srsStageLabel ?? null,
    };
  }, [curriculumDb, userDb, itemId]);
}
