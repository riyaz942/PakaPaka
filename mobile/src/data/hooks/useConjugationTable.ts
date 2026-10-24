import { useMemo } from 'react';

import {
  conjugate,
  type ConjugationClass,
  type ConjugationTable,
} from '@/core/content/conjugation';
import { getConjugationClass, type CurriculumItemDetail } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export type WordConjugation = { cls: ConjugationClass; table: ConjugationTable };

/**
 * The 8-form table for a vocabulary word, or null when it gets none: no class
 * in the curriculum, an older DB, or a class the conjugator cannot apply to
 * the word's ending. Null always means "show no table", never a guess.
 */
export function useConjugationTable(
  item: Pick<CurriculumItemDetail, 'id' | 'primaryForm' | 'furigana'>,
): WordConjugation | null {
  const { curriculumDb } = useDatabase();

  return useMemo(() => {
    const cls = getConjugationClass(curriculumDb, item.id);
    if (!cls) {
      return null;
    }
    const table = conjugate({ primaryForm: item.primaryForm, furigana: item.furigana }, cls);
    return table ? { cls, table } : null;
  }, [curriculumDb, item.id, item.primaryForm, item.furigana]);
}
