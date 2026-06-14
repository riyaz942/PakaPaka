import { useEffect, useState } from 'react';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  countItemsByLevel,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export function useItemCountsByLevel(
  jlptLevel: JLPTLevel | null,
): { counts: Record<ItemType, number>; loading: boolean } {
  const { curriculumDb } = useDatabase();
  const [counts, setCounts] = useState<Record<ItemType, number>>({
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    grammar: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jlptLevel) {
      setCounts({ radical: 0, kanji: 0, vocabulary: 0, grammar: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextCounts = countItemsByLevel(curriculumDb, jlptLevel);
    setCounts(nextCounts);
    setLoading(false);
  }, [curriculumDb, jlptLevel]);

  return { counts, loading };
}
