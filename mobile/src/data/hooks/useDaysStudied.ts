import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { countDaysStudiedInMonth } from '@/data/user/cognitiveLoadRepository';

type UseDaysStudiedResult = {
  daysStudied: number;
  isLoading: boolean;
  refetch: () => void;
};

/** Days studied in the current local month (UX-DR20). */
export function useDaysStudied(): UseDaysStudiedResult {
  const { userDb } = useDatabase();
  const [daysStudied, setDaysStudied] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      const now = new Date();
      setDaysStudied(countDaysStudiedInMonth(userDb, now.getFullYear(), now.getMonth() + 1));
    } catch {
      setDaysStudied(0);
    } finally {
      setIsLoading(false);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { daysStudied, isLoading, refetch };
}
