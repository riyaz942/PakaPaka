import { useMemo } from 'react';

import { listRadicalsByLevel } from '@/data/curriculum/radicalRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export function useRadicals(jlptLevel = 'N5') {
  const { curriculumDb } = useDatabase();

  return useMemo(
    () => listRadicalsByLevel(curriculumDb, jlptLevel),
    [curriculumDb, jlptLevel],
  );
}
