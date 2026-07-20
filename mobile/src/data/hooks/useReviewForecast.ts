import { useCallback, useEffect, useState } from 'react';

import { buildReviewForecast, type ReviewForecast } from '@/core/engagement/reviewForecast';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getUpcomingDueDates } from '@/data/user/srsStateRepository';

type UseReviewForecastResult = {
  forecast: ReviewForecast | null;
  isLoading: boolean;
  refetch: () => void;
};

/** Seven-day due forecast for Home (FR58) — due dates only, no queue build. */
export function useReviewForecast(): UseReviewForecastResult {
  const { userDb } = useDatabase();
  const [forecast, setForecast] = useState<ReviewForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      const now = new Date();
      // Start of local day today+7 — the exclusive end of the 7-day window.
      const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      const dueDates = getUpcomingDueDates(userDb, until.toISOString());
      setForecast(buildReviewForecast(dueDates, now));
    } catch {
      setForecast(null);
    } finally {
      setIsLoading(false);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { forecast, isLoading, refetch };
}
