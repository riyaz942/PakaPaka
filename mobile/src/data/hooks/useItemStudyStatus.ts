import { useMemo } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { getStudyStatusOrDefault } from '@/data/user/itemStudyStatusRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

/** Study status for one item, defaulting to `not_started` when never recorded. */
export function useItemStudyStatus(itemId: string | null): StudyStatus {
  const { userDb } = useDatabase();

  return useMemo(
    () => (itemId ? getStudyStatusOrDefault(userDb, itemId) : 'not_started'),
    [userDb, itemId],
  );
}
