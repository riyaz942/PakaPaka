import { useCallback, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import { getKnownKanjiCharacters } from '@/data/user/masteryRepository';
import {
  getFuriganaDisplay,
  setFuriganaDisplay,
  type FuriganaDisplayMode,
} from '@/data/user/preferencesRepository';

type UseFuriganaPreferenceResult = {
  mode: FuriganaDisplayMode;
  setMode: (mode: FuriganaDisplayMode) => void;
  /** Known kanji characters for 'auto' mode, computed once per mount. */
  knownKanji: ReadonlySet<string>;
  /** Call after an action that changes mastery (e.g. bulk-mark) to recompute. */
  refreshKnownKanji: () => void;
};

export function useFuriganaPreference(): UseFuriganaPreferenceResult {
  const { userDb } = useDatabase();
  const [mode, setModeState] = useState<FuriganaDisplayMode>(() => getFuriganaDisplay(userDb));
  const [knownKanji, setKnownKanji] = useState<ReadonlySet<string>>(() =>
    getKnownKanjiCharacters(userDb),
  );

  const setMode = useCallback(
    (next: FuriganaDisplayMode) => {
      setFuriganaDisplay(userDb, next);
      setModeState(next);
    },
    [userDb],
  );

  const refreshKnownKanji = useCallback(() => {
    setKnownKanji(getKnownKanjiCharacters(userDb));
  }, [userDb]);

  return { mode, setMode, knownKanji, refreshKnownKanji };
}
