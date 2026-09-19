import { useCallback, useEffect, useState } from 'react';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { computeItemCategoryProgress } from '@/data/hooks/levelProgressShared';
import type { AppError } from '@/types/result.types';

type ProgressType = 'kanji' | 'vocabulary' | 'grammar';

type TypeProgress = {
  started: number;
  total: number;
};

type UseLevelProgressResult = {
  level: JLPTLevel | null;
  perType: Record<ProgressType, TypeProgress>;
  overallPercent: number;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

const PROGRESS_TYPES: ProgressType[] = ['kanji', 'vocabulary', 'grammar'];

const EMPTY_PER_TYPE: Record<ProgressType, TypeProgress> = {
  kanji: { started: 0, total: 0 },
  vocabulary: { started: 0, total: 0 },
  grammar: { started: 0, total: 0 },
};

export function useLevelProgress(level: JLPTLevel | null): UseLevelProgressResult {
  const { curriculumDb, userDb } = useDatabase();
  const [perType, setPerType] = useState(EMPTY_PER_TYPE);
  const [overallPercent, setOverallPercent] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    if (!level) {
      setPerType(EMPTY_PER_TYPE);
      setOverallPercent(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextPerType = computeItemCategoryProgress(curriculumDb, userDb, level, PROGRESS_TYPES);
      let sumStarted = 0;
      let sumTotal = 0;

      for (const itemType of PROGRESS_TYPES) {
        sumStarted += nextPerType[itemType].started;
        sumTotal += nextPerType[itemType].total;
      }

      setPerType(nextPerType);
      setOverallPercent(sumTotal > 0 ? Math.round((100 * sumStarted) / sumTotal) : 0);
    } catch (cause) {
      setPerType(EMPTY_PER_TYPE);
      setOverallPercent(0);
      setError({
        code: 'level_progress_load_failed',
        message: 'Failed to load level progress',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, level, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((current) => current + 1);
  }, []);

  return {
    level,
    perType,
    overallPercent,
    isLoading,
    error,
    refetch,
  };
}
