import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getReducedMotionEnabled,
  setReducedMotionEnabled,
} from '@/data/user/preferencesRepository';

type UseReducedMotionResult = {
  /** Effective reduced-motion state (in-app override or system). */
  reducedMotion: boolean;
  /** In-app preference; null means follow the system setting. */
  preference: boolean | null;
  setReducedMotion: (enabled: boolean) => void;
};

export function useReducedMotion(): UseReducedMotionResult {
  const { userDb } = useDatabase();
  const [preference, setPreference] = useState<boolean | null>(() =>
    getReducedMotionEnabled(userDb),
  );
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setSystemReducedMotion(enabled);
        }
      })
      .catch(() => {
        if (active) {
          setSystemReducedMotion(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setSystemReducedMotion(enabled);
      },
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const setReducedMotion = useCallback(
    (enabled: boolean) => {
      setReducedMotionEnabled(userDb, enabled);
      setPreference(enabled);
    },
    [userDb],
  );

  const reducedMotion = systemReducedMotion || preference === true;

  return { reducedMotion, preference, setReducedMotion };
}
