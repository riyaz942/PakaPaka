import { useMemo } from 'react';

import {
  getComponentParentsForItem,
  type CurriculumParentItem,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

/** Type-appropriate component parents for FR72 cross-ref chips. */
export function useComponentParents(
  itemId: string | null,
  itemType: ItemType | null,
): CurriculumParentItem[] {
  const { curriculumDb } = useDatabase();

  return useMemo(() => {
    if (!itemId || !itemType) {
      return [];
    }
    return getComponentParentsForItem(curriculumDb, itemId, itemType);
  }, [curriculumDb, itemId, itemType]);
}
