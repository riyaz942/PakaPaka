import { useCallback, useEffect, useState } from 'react';

import { computeLoadPercent } from '@/core/cognitive-load/loadTracker';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { resolveDailyGoalTarget } from '@/data/user/goalRingRepository';
import type { AppError } from '@/types/result.types';

type UseCognitiveLoadResult = {
  todayLoad: number;
  /** Today's lessons + reviews, in items — the ring's denominator. */
  threshold: number;
  /** Unclamped: overshoot reads >100. */
  percent: number;
  isComplete: boolean;
  isOvershoot: boolean;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

export function useCognitiveLoad(): UseCognitiveLoadResult {
  const { curriculumDb, userDb } = useDatabase();
  const [todayLoad, setTodayLoad] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      const daily = getDailyLoad(userDb, todayKey());
      const goal = resolveDailyGoalTarget(curriculumDb, userDb);

      setTodayLoad(daily?.load ?? 0);
      setThreshold(goal);
    } catch (cause) {
      setError({
        code: 'cognitive_load_load_failed',
        message: 'Failed to load cognitive load',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((current) => current + 1);
  }, []);

  const percent = computeLoadPercent(todayLoad, threshold);

  return {
    todayLoad,
    threshold,
    percent,
    isComplete: percent >= 100,
    isOvershoot: percent > 100,
    isLoading,
    error,
    refetch,
  };
}
