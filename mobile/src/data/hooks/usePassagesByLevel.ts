import { useEffect, useState } from 'react';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  listPassagesByLevel,
  type PassageListItem,
} from '@/data/curriculum/passageRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export function usePassagesByLevel(
  jlptLevel: JLPTLevel | null,
): { passages: PassageListItem[]; loading: boolean } {
  const { curriculumDb } = useDatabase();
  const [passages, setPassages] = useState<PassageListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jlptLevel) {
      setPassages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextPassages = listPassagesByLevel(curriculumDb, jlptLevel);
    setPassages(nextPassages);
    setLoading(false);
  }, [curriculumDb, jlptLevel]);

  return { passages, loading };
}
