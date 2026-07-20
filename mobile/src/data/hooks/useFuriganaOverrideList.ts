import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { subscribeFuriganaOverrides } from '@/data/user/furiganaOverrideEvents';
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
 * renders an empty shell that fills in a tick later. Subscribes to override
 * writes so a reset on this screen (or a set on a detail page) stays in sync
 * with other mounted furigana surfaces.
 */
export function useFuriganaOverrideList(): UseFuriganaOverrideListResult {
  const { userDb } = useDatabase();
  const [entries, setEntries] = useState<FuriganaOverrideEntry[]>(() =>
    listFuriganaOverrides(userDb),
  );

  useEffect(() => {
    return subscribeFuriganaOverrides(() => {
      setEntries(listFuriganaOverrides(userDb));
    });
  }, [userDb]);

  const clearOne = useCallback(
    (itemId: string) => {
      clearFuriganaOverride(userDb, itemId);
    },
    [userDb],
  );

  const clearAll = useCallback(() => {
    clearAllFuriganaOverrides(userDb);
  }, [userDb]);

  return { entries, clearOne, clearAll };
}
