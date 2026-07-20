import { useCallback, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  clearAllFuriganaOverrides,
  clearFuriganaOverride,
  listFuriganaOverrides,
  type FuriganaOverrideEntry,
} from '@/data/user/furiganaOverrideRepository';

type UseFuriganaOverrideListResult = {
  /** Every per-word override with its word label, newest first. */
  entries: FuriganaOverrideEntry[];
  clearOne: (itemId: string) => void;
  clearAll: () => void;
};

/**
 * The Settings view of per-word furigana overrides (AC #3): list them, drop one,
 * or reset them all.
 *
 * Read synchronously on mount rather than in an effect, so the list never
 * renders an empty shell that fills in a tick later.
 */
export function useFuriganaOverrideList(): UseFuriganaOverrideListResult {
  const { userDb } = useDatabase();
  const [entries, setEntries] = useState<FuriganaOverrideEntry[]>(() =>
    listFuriganaOverrides(userDb),
  );

  const clearOne = useCallback(
    (itemId: string) => {
      clearFuriganaOverride(userDb, itemId);
      setEntries((previous) => previous.filter((entry) => entry.itemId !== itemId));
    },
    [userDb],
  );

  const clearAll = useCallback(() => {
    clearAllFuriganaOverrides(userDb);
    setEntries([]);
  }, [userDb]);

  return { entries, clearOne, clearAll };
}
