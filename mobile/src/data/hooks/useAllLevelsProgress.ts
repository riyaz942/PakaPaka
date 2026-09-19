import { useCallback, useEffect, useState } from 'react';

import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import { listLevelsWithContent } from '@/data/curriculum/itemRepository';
import { listPassagesByLevel } from '@/data/curriculum/passageRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  computeItemCategoryProgress,
  type CategoryProgress,
  type ItemProgressCategory,
} from '@/data/hooks/levelProgressShared';
import { countPassagesWithResultsByIds } from '@/data/user/passagePracticeRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import type { AppError } from '@/types/result.types';

export type LevelProgressCategory = ItemProgressCategory | 'passage';

export type LevelProgressSummary = {
  level: JLPTLevel;
  perCategory: Record<LevelProgressCategory, CategoryProgress>;
  overallPercent: number;
  hasFullContent: boolean;
};

type UseAllLevelsProgressResult = {
  levels: LevelProgressSummary[];
  activeLevel: JLPTLevel | null;
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
};

const ITEM_CATEGORIES: ItemProgressCategory[] = ['radical', 'kanji', 'vocabulary', 'grammar'];

export function useAllLevelsProgress(): UseAllLevelsProgressResult {
  const { curriculumDb, userDb } = useDatabase();
  const [levels, setLevels] = useState<LevelProgressSummary[]>([]);
  const [activeLevel, setActiveLevel] = useState<JLPTLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    try {
      const fullContentLevels = new Set(listLevelsWithContent(curriculumDb));

      const nextLevels = JLPT_LEVELS.map((level) => {
        const itemCategories = computeItemCategoryProgress(curriculumDb, userDb, level, ITEM_CATEGORIES);
        const passages = listPassagesByLevel(curriculumDb, level);
        const passageStarted = countPassagesWithResultsByIds(
          userDb,
          passages.map((passage) => passage.id),
        );

        const perCategory: Record<LevelProgressCategory, CategoryProgress> = {
          ...itemCategories,
          passage: { started: passageStarted, total: passages.length },
        };

        let sumStarted = 0;
        let sumTotal = 0;
        for (const category of Object.values(perCategory)) {
          sumStarted += category.started;
          sumTotal += category.total;
        }

        return {
          level,
          perCategory,
          overallPercent: sumTotal > 0 ? Math.round((100 * sumStarted) / sumTotal) : 0,
          hasFullContent: fullContentLevels.has(level),
        };
      });

      setLevels(nextLevels);
      setActiveLevel(getStartingJlptLevel(userDb));
    } catch (cause) {
      setLevels([]);
      setActiveLevel(null);
      setError({
        code: 'all_levels_progress_load_failed',
        message: 'Failed to load levels progress',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((current) => current + 1);
  }, []);

  return {
    levels,
    activeLevel,
    isLoading,
    error,
    refetch,
  };
}
