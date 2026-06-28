import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SRSStageLabel } from '@/core/srs/srs.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getSrsStageCounts } from '@/data/user/srsStateRepository';
import type { AppError } from '@/types/result.types';

type UseSRSBreakdownResult = {
  counts: Record<SRSStageLabel, number>;
  total: number;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

export function useSRSBreakdown(): UseSRSBreakdownResult {
  const { userDb } = useDatabase();
  const [counts, setCounts] = useState<Record<SRSStageLabel, number>>({
    apprentice: 0,
    guru: 0,
    master: 0,
    enlightened: 0,
    burned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      setCounts(getSrsStageCounts(userDb));
    } catch (cause) {
      setError({
        code: 'srs_breakdown_load_failed',
        message: 'Failed to load SRS stage breakdown',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((current) => current + 1);
  }, []);

  const total = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );

  return { counts, total, isLoading, error, refetch };
}
