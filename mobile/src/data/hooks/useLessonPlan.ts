import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { buildLessonPlan, EMPTY_LESSON_PLAN, type LessonPlan } from '@/data/lessonPlan';

export type { LessonPlan } from '@/data/lessonPlan';

export type UseLessonPlanOptions = {
  /** Bypass the daily allowance ("Learn anyway"). The cap is advisory, not a hard block. */
  ignoreAllowance?: boolean;
};

/**
 * Today's lesson, from `buildLessonPlan`. Re-reads on `refetch` and when the
 * allowance bypass changes.
 */
export function useLessonPlan(
  options: UseLessonPlanOptions = {},
): LessonPlan & { isLoading: boolean; refetch: () => void } {
  const { ignoreAllowance = false } = options;
  const { curriculumDb, userDb } = useDatabase();
  const [plan, setPlan] = useState<LessonPlan>(EMPTY_LESSON_PLAN);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      setPlan(buildLessonPlan(curriculumDb, userDb, { ignoreAllowance }));
    } catch {
      setPlan(EMPTY_LESSON_PLAN);
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount, ignoreAllowance]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { ...plan, isLoading, refetch };
}
