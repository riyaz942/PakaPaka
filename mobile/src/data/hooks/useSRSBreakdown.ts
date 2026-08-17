import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SRSStageLabel } from '@/core/srs/srs.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { countReadingLockedVocabulary } from '@/data/user/masteryRepository';
import { getSrsStageCounts } from '@/data/user/srsStateRepository';
import type { AppError } from '@/types/result.types';

type UseSRSBreakdownResult = {
  counts: Record<SRSStageLabel, number>;
  total: number;
  /**
   * Words held at master by v2 rule 3 — part of the counts above, and unable to
   * climb past master until their kanji are learned.
   */
  readingLockedCount: number;
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
  const [readingLockedCount, setReadingLockedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      setCounts(getSrsStageCounts(userDb));
      setReadingLockedCount(countReadingLockedVocabulary(userDb));
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

  return { counts, total, readingLockedCount, isLoading, error, refetch };
}
