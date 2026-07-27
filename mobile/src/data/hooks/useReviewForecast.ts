import { useCallback, useEffect, useState } from 'react';

import { buildReviewForecast, type ReviewForecast } from '@/core/engagement/reviewForecast';
import { useDatabase } from '@/data/hooks/useDatabase';
import { filterServableItemIds } from '@/data/reviewEligibility';
import { getUpcomingDueItems } from '@/data/user/srsStateRepository';

type UseReviewForecastResult = {
  forecast: ReviewForecast | null;
  isLoading: boolean;
  refetch: () => void;
};

/** Seven-day due forecast for Home (FR58) — due dates only, no queue build. */
export function useReviewForecast(): UseReviewForecastResult {
  const { curriculumDb, userDb } = useDatabase();
  const [forecast, setForecast] = useState<ReviewForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      const now = new Date();
      // Start of local day today+7 — the exclusive end of the 7-day window.
      const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      const upcoming = getUpcomingDueItems(userDb, until.toISOString());
      // Same eligibility filter as Home's "N items ready", so the forecast's
      // today split can't promise reviews the session won't serve (Plan 12.8).
      const servable = filterServableItemIds(
        curriculumDb,
        userDb,
        upcoming.map((due) => due.itemId),
      );
      setForecast(
        buildReviewForecast(
          upcoming.filter((due) => servable.has(due.itemId)).map((due) => due.dueDate),
          now,
        ),
      );
    } catch {
      setForecast(null);
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { forecast, isLoading, refetch };
}
