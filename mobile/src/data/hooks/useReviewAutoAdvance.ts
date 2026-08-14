import { useCallback, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getReviewAutoAdvanceEnabled,
  setReviewAutoAdvanceEnabled,
} from '@/data/user/preferencesRepository';

type UseReviewAutoAdvanceResult = {
  /** Lightning Mode: auto-advance after a correct answer. Default OFF (FR84). */
  autoAdvanceEnabled: boolean;
  setAutoAdvanceEnabled: (enabled: boolean) => void;
  /** Re-read from user.db after an out-of-band write (restore). */
  refetch: () => void;
};

export function useReviewAutoAdvance(): UseReviewAutoAdvanceResult {
  const { userDb } = useDatabase();
  const [autoAdvanceEnabled, setEnabledState] = useState(() =>
    getReviewAutoAdvanceEnabled(userDb),
  );

  const setAutoAdvanceEnabled = useCallback(
    (enabled: boolean) => {
      setReviewAutoAdvanceEnabled(userDb, enabled);
      setEnabledState(enabled);
    },
    [userDb],
  );

  const refetch = useCallback(() => {
    setEnabledState(getReviewAutoAdvanceEnabled(userDb));
  }, [userDb]);

  return { autoAdvanceEnabled, setAutoAdvanceEnabled, refetch };
}
