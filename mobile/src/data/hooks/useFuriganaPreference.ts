import { useCallback, useState } from 'react';

import { resolveFuriganaMode } from '@/core/furigana/resolveFuriganaMode';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  clearAllFuriganaOverrides,
  clearFuriganaOverride,
  getAllFuriganaOverrides,
  setFuriganaOverride,
  type FuriganaOverrideMode,
} from '@/data/user/furiganaOverrideRepository';
import { getKnownVocabularyCharacters } from '@/data/user/masteryRepository';
import {
  getFuriganaDisplay,
  setFuriganaDisplay,
  type FuriganaDisplayMode,
} from '@/data/user/preferencesRepository';

type UseFuriganaPreferenceResult = {
  mode: FuriganaDisplayMode;
  setMode: (mode: FuriganaDisplayMode) => void;
  /**
   * Characters appearing in mastered vocabulary, for 'auto' mode on embedded
   * multi-word text. Computed once per mount.
   */
  knownKanji: ReadonlySet<string>;
  /** Call after an action that changes mastery (e.g. bulk-mark) to recompute. */
  refreshKnownKanji: () => void;
  /** Every persistent per-word override, read once per mount. */
  overrides: ReadonlyMap<string, FuriganaOverrideMode>;
  /**
   * Effective display mode for one word: Settings override → global mode.
   * The SRS default sits between them and is applied by `<FuriganaText>`'s
   * `isKnownWord` prop, which only matters once this returns 'auto'.
   */
  modeForItem: (itemId: string | null | undefined) => FuriganaDisplayMode;
  setOverride: (itemId: string, mode: FuriganaOverrideMode) => void;
  clearOverride: (itemId: string) => void;
  clearAllOverrides: () => void;
};

export function useFuriganaPreference(): UseFuriganaPreferenceResult {
  const { userDb } = useDatabase();
  const [mode, setModeState] = useState<FuriganaDisplayMode>(() => getFuriganaDisplay(userDb));
  const [knownKanji, setKnownKanji] = useState<ReadonlySet<string>>(() =>
    getKnownVocabularyCharacters(userDb),
  );
  // Read synchronously on mount (not in an effect) so the first paint already
  // has the right overrides — a settle-later effect would flash the wrong mode.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, FuriganaOverrideMode>>(() =>
    getAllFuriganaOverrides(userDb),
  );

  const setMode = useCallback(
    (next: FuriganaDisplayMode) => {
      setFuriganaDisplay(userDb, next);
      setModeState(next);
    },
    [userDb],
  );

  const refreshKnownKanji = useCallback(() => {
    setKnownKanji(getKnownVocabularyCharacters(userDb));
  }, [userDb]);

  const modeForItem = useCallback(
    (itemId: string | null | undefined): FuriganaDisplayMode =>
      resolveFuriganaMode(itemId ? overrides.get(itemId) : null, mode),
    [overrides, mode],
  );

  const setOverride = useCallback(
    (itemId: string, next: FuriganaOverrideMode) => {
      setFuriganaOverride(userDb, itemId, next);
      setOverrides((previous) => new Map(previous).set(itemId, next));
    },
    [userDb],
  );

  const clearOverride = useCallback(
    (itemId: string) => {
      clearFuriganaOverride(userDb, itemId);
      setOverrides((previous) => {
        const next = new Map(previous);
        next.delete(itemId);
        return next;
      });
    },
    [userDb],
  );

  const clearAllOverrides = useCallback(() => {
    clearAllFuriganaOverrides(userDb);
    setOverrides(new Map());
  }, [userDb]);

  return {
    mode,
    setMode,
    knownKanji,
    refreshKnownKanji,
    overrides,
    modeForItem,
    setOverride,
    clearOverride,
    clearAllOverrides,
  };
}
