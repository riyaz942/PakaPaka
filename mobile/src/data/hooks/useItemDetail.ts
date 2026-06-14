import { useEffect, useState } from 'react';

import {
  getItemById,
  type CurriculumItemDetail,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export function useItemDetail(
  itemId: string | null,
): { item: CurriculumItemDetail | null; loading: boolean; notFound: boolean } {
  const { curriculumDb } = useDatabase();
  const [item, setItem] = useState<CurriculumItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const detail = getItemById(curriculumDb, itemId);
    setItem(detail);
    setNotFound(detail === null);
    setLoading(false);
  }, [curriculumDb, itemId]);

  return { item, loading, notFound };
}
