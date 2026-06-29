import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import {
  getStreak,
  yesterdayKey,
  type StreakState,
} from '@/data/user/streakRepository';
import type { AppError } from '@/types/result.types';

type UseStreakResult = {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  streakState: StreakState;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

function deriveStreakState(
  currentStreak: number,
  lastReviewDate: string | null,
  today: string,
): StreakState {
  if (currentStreak > 0 && lastReviewDate === today) {
    return 'active';
  }
  if (currentStreak > 0 && lastReviewDate === yesterdayKey(today)) {
    return 'at-risk';
  }
  return 'broken';
}

export function useStreak(): UseStreakResult {
  const { userDb } = useDatabase();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastReviewDate, setLastReviewDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    try {
      const streak = getStreak(userDb);
      setCurrentStreak(streak.currentStreak);
      setLongestStreak(streak.longestStreak);
      setLastReviewDate(streak.lastReviewDate);
    } catch (cause) {
      setError({
        code: 'streak_load_failed',
        message: 'Failed to load streak',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((current) => current + 1);
  }, []);

  const today = todayKey();
  const streakState = deriveStreakState(currentStreak, lastReviewDate, today);

  return {
    currentStreak,
    longestStreak,
    lastReviewDate,
    streakState,
    isLoading,
    error,
    refetch,
  };
}
