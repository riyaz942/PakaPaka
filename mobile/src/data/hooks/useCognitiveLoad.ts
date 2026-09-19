import { useCallback, useEffect, useState } from 'react';

import { computeLoadPercent } from '@/core/cognitive-load/loadTracker';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import {
  getGoalRingState,
  resolveDailyGoalTarget,
  runWeeklyGoalCheck,
} from '@/data/user/goalRingRepository';
import { isVacationActive } from '@/data/user/vacationRepository';
import type { AppError } from '@/types/result.types';

type UseCognitiveLoadResult = {
  todayLoad: number;
  /** Sticky daily goal, in items — the ring's denominator. */
  threshold: number;
  /** Unclamped: overshoot reads >100. */
  percent: number;
  isComplete: boolean;
  isOvershoot: boolean;
  /** Proposed higher goal awaiting user acknowledgement (weekly ratchet). */
  pendingRiseTo: number | null;
  /** Opt-in reduction offer after sustained miss weeks. */
  pendingReductionTo: number | null;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

export function useCognitiveLoad(): UseCognitiveLoadResult {
  const { userDb } = useDatabase();
  const [todayLoad, setTodayLoad] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [pendingRiseTo, setPendingRiseTo] = useState<number | null>(null);
  const [pendingReductionTo, setPendingReductionTo] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      // Weekly ratchet runs on read: at most once per calendar week it turns
      // last week's active days into pending rise/reduction offers. Best-effort
      // — a failed check must not take down the ring. Skipped during vacation
      // mode so weeks away are never judged as missed; endVacation re-anchors.
      if (!isVacationActive(userDb)) {
        const checkResult = runWeeklyGoalCheck(userDb);
        if (!checkResult.ok && __DEV__) {
          console.warn('[useCognitiveLoad] weekly goal check failed', checkResult.error);
        }
      }

      const daily = getDailyLoad(userDb, todayKey());
      const goal = resolveDailyGoalTarget(userDb);
      const goalState = getGoalRingState(userDb);

      setTodayLoad(daily?.load ?? 0);
      setThreshold(goal);
      setPendingRiseTo(goalState.pendingRiseTo);
      setPendingReductionTo(goalState.pendingReductionTo);
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

  return {
    todayLoad,
    threshold,
    percent,
    isComplete: percent >= 100,
    isOvershoot: percent > 100,
    pendingRiseTo,
    pendingReductionTo,
    isLoading,
    error,
    refetch,
  };
}
