import { useMemo } from 'react';

import {
  getTaughtConjugatedForms,
  type TaughtConjugatedForm,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

/** Taught inflections a word is actually shown in (14.1), for its detail page. */
export function useConjugatedForms(itemId: string | null): TaughtConjugatedForm[] {
  const { curriculumDb } = useDatabase();

  return useMemo(() => {
    if (!itemId) {
      return [];
    }
    return getTaughtConjugatedForms(curriculumDb, itemId);
  }, [curriculumDb, itemId]);
}
