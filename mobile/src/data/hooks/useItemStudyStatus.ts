import { useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { getStudyStatusOrDefault } from '@/data/user/itemStudyStatusRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

/** Study status for one item, defaulting to `not_started` when never recorded. */
export function useItemStudyStatus(itemId: string | null): StudyStatus {
  const { userDb } = useDatabase();
  const [status, setStatus] = useState<StudyStatus>('not_started');

  useEffect(() => {
    setStatus(itemId ? getStudyStatusOrDefault(userDb, itemId) : 'not_started');
  }, [userDb, itemId]);

  return status;
}
