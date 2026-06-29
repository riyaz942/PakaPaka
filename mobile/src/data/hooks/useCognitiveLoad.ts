import { useCallback, useEffect, useState } from 'react';

import { COGNITIVE_LOAD_HISTORY_WINDOW } from '@/config/constants';
import { computeLoadPercent } from '@/core/cognitive-load/loadTracker';
import { computeThreshold } from '@/core/cognitive-load/thresholdCalculator';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getDailyLoad,
  getRecentDailyLoads,
  todayKey,
} from '@/data/user/cognitiveLoadRepository';
import { getSessionIntensity } from '@/data/user/preferencesRepository';
import type { AppError } from '@/types/result.types';

type UseCognitiveLoadResult = {
  todayLoad: number;
  threshold: number;
  percent: number;
  isComplete: boolean;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

export function useCognitiveLoad(): UseCognitiveLoadResult {
  const { userDb } = useDatabase();
  const [todayLoad, setTodayLoad] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      const today = todayKey();
      const daily = getDailyLoad(userDb, today);
      const load = daily?.load ?? 0;
      const recentLoads = getRecentDailyLoads(userDb, today, COGNITIVE_LOAD_HISTORY_WINDOW);
      const intensity = getSessionIntensity(userDb) ?? 'relaxed';
      const computedThreshold = computeThreshold({ intensity, recentLoads });

      setTodayLoad(load);
      setThreshold(computedThreshold);
    } catch (cause) {
      setError({
        code: 'cognitive_load_load_failed',
        message: 'Failed to load cognitive load',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((current) => current + 1);
  }, []);

  const percent = computeLoadPercent(todayLoad, threshold);
  const isComplete = percent >= 100;

  return { todayLoad, threshold, percent, isComplete, isLoading, error, refetch };
}
