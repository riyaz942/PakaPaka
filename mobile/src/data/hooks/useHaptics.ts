import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getHapticsEnabled,
  setHapticsEnabled as storeHapticsEnabled,
} from '@/data/user/preferencesRepository';

/**
 * - `success` — goal reached, passage unlocked
 * - `error`   — wrong answer
 * - `warning` — close answer, try again
 * - `light`   — correct answer, edge bump, release
 * - `medium`  — start of hold-to-speak
 * - `selection` — a segmented choice changed
 */
export type HapticKind = 'success' | 'error' | 'warning' | 'light' | 'medium' | 'selection';

function fire(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'selection':
      return Haptics.selectionAsync();
  }
}

/**
 * Plays haptics when vibration is on in Settings. The preference is read at
 * play time — not on render — so a screen that stayed mounted while the learner
 * changed the setting follows the new value.
 */
export function useHaptics(): { play: (kind: HapticKind) => void } {
  const { userDb } = useDatabase();

  const play = useCallback(
    (kind: HapticKind) => {
      if (!getHapticsEnabled(userDb)) return;
      // A device without a vibration motor rejects; there is nothing to show.
      fire(kind).catch(() => {});
    },
    [userDb],
  );

  return { play };
}

/** The Settings toggle for vibration. */
export function useHapticsPreference(): {
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  /** Re-read the preference after an out-of-band write (restore). */
  refetch: () => void;
} {
  const { userDb } = useDatabase();
  const [hapticsEnabled, setEnabledState] = useState(() => getHapticsEnabled(userDb));

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      storeHapticsEnabled(userDb, enabled);
      setEnabledState(enabled);
    },
    [userDb],
  );

  const refetch = useCallback(() => {
    setEnabledState(getHapticsEnabled(userDb));
  }, [userDb]);

  return { hapticsEnabled, setHapticsEnabled, refetch };
}
