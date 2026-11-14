import { useCallback, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getThemeMode,
  setThemeMode as persistThemeMode,
  type ThemeMode,
} from '@/data/user/preferencesRepository';
import { supportsThemeOverride } from '@/platform/capabilities';

type UseThemeModeResult = {
  /** Stored preference: 'system' follows the device. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

/**
 * Applies the stored light/dark preference through `Appearance.setColorScheme`,
 * which is the same override NativeWind's own `setColorScheme` writes. The palette
 * is compiled from `prefers-color-scheme` media queries and NativeWind evaluates
 * those against the Appearance-derived scheme, so overriding it repaints the
 * surfaces, the status bar and the navigation chrome together.
 */
export function useThemeMode(): UseThemeModeResult {
  const { userDb } = useDatabase();
  const [mode, setModeState] = useState<ThemeMode>(() => getThemeMode(userDb));

  useEffect(() => {
    if (!supportsThemeOverride()) {
      return;
    }
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      persistThemeMode(userDb, next);
      setModeState(next);
    },
    [userDb],
  );

  return { mode, setMode };
}
