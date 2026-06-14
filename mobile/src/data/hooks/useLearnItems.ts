import { useEffect, useState } from 'react';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  listItemsByLevelAndType,
  type CurriculumListItem,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export function useLearnItems(
  jlptLevel: JLPTLevel | null,
  itemType: ItemType,
): { items: CurriculumListItem[]; loading: boolean } {
  const { curriculumDb } = useDatabase();
  const [items, setItems] = useState<CurriculumListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jlptLevel) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextItems = listItemsByLevelAndType(curriculumDb, jlptLevel, itemType);
    setItems(nextItems);
    setLoading(false);
  }, [curriculumDb, jlptLevel, itemType]);

  return { items, loading };
}
