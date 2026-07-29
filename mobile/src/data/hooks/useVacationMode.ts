import { useCallback, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { getVacationStartedAt } from '@/data/user/preferencesRepository';
import {
  endVacation,
  startVacation,
  type VacationResumeSummary,
} from '@/data/user/vacationRepository';
import type { AppError, Result } from '@/types/result.types';

type UseVacationModeResult = {
  /** Reviews and lessons are frozen while true. */
  isVacationActive: boolean;
  /** ISO timestamp the break began, or null when off. */
  startedAt: string | null;
  start: () => void;
  /** Resumes and reports how many cards were rescheduled. */
  end: () => Result<VacationResumeSummary, AppError>;
};

export function useVacationMode(): UseVacationModeResult {
  const { userDb } = useDatabase();
  const [startedAt, setStartedAt] = useState<string | null>(() =>
    getVacationStartedAt(userDb),
  );

  const start = useCallback(() => {
    startVacation(userDb);
    setStartedAt(getVacationStartedAt(userDb));
  }, [userDb]);

  const end = useCallback(() => {
    const result = endVacation(userDb);
    if (result.ok) {
      setStartedAt(null);
    }
    return result;
  }, [userDb]);

  return { isVacationActive: startedAt !== null, startedAt, start, end };
}
