import { useCallback, useEffect, useState } from 'react';

import {
  SHADOW_MODE_FEATURE_ENABLED,
  SHADOW_MODE_SNOOZE_DAYS,
  SHADOW_MODE_SWITCH_PROMPT_DAYS,
} from '@/config/constants';
import { useDatabase } from '@/data/hooks/useDatabase';
import { countImportMetadataRows } from '@/data/user/importRepository';
import {
  getShadowModeEnabled,
  getShadowModeEnabledAt,
  getShadowModePromptDismissed,
  getShadowModePromptSnoozedUntil,
  setShadowModeEnabled,
  setShadowModePromptDismissed,
  setShadowModePromptSnoozedUntil,
} from '@/data/user/preferencesRepository';

const MS_PER_DAY = 86_400_000;

type UseShadowModeResult = {
  /** Build-level gate — mirrors SHADOW_MODE_FEATURE_ENABLED. */
  isFeatureEnabled: boolean;
  /** Feature on AND the learner has imported progress (FR33i-PM gate). */
  canEnable: boolean;
  /** Feature on AND the user preference is enabled. */
  isEnabled: boolean;
  enabledAt: Date | null;
  /** Whole days since enabledAt, floored. 0 when never enabled. */
  daysActive: number;
  shouldShowSwitchPrompt: boolean;
  enable: () => void;
  disable: () => void;
  dismissPrompt: () => void;
  snoozePrompt: () => void;
  refetch: () => void;
};

const OFF_DEFAULTS = {
  isEnabled: false,
  enabledAt: null as Date | null,
  canEnable: false,
  dismissed: false,
  snoozedUntil: null as Date | null,
};

export function useShadowMode(): UseShadowModeResult {
  const { userDb } = useDatabase();
  const [isEnabled, setIsEnabledState] = useState(OFF_DEFAULTS.isEnabled);
  const [enabledAt, setEnabledAt] = useState(OFF_DEFAULTS.enabledAt);
  const [canEnable, setCanEnable] = useState(OFF_DEFAULTS.canEnable);
  const [dismissed, setDismissed] = useState(OFF_DEFAULTS.dismissed);
  const [snoozedUntil, setSnoozedUntil] = useState(OFF_DEFAULTS.snoozedUntil);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    // Dormant build: never read shadow-mode preferences, so AC1 holds with
    // zero shadow-mode code path executing during onboarding, review, or Home.
    if (!SHADOW_MODE_FEATURE_ENABLED) {
      return;
    }
    try {
      setIsEnabledState(getShadowModeEnabled(userDb));
      const enabledAtIso = getShadowModeEnabledAt(userDb);
      setEnabledAt(enabledAtIso ? new Date(enabledAtIso) : null);
      setCanEnable(countImportMetadataRows(userDb) > 0);
      setDismissed(getShadowModePromptDismissed(userDb));
      const snoozedIso = getShadowModePromptSnoozedUntil(userDb);
      setSnoozedUntil(snoozedIso ? new Date(snoozedIso) : null);
    } catch {
      setIsEnabledState(OFF_DEFAULTS.isEnabled);
      setEnabledAt(OFF_DEFAULTS.enabledAt);
      setCanEnable(OFF_DEFAULTS.canEnable);
      setDismissed(OFF_DEFAULTS.dismissed);
      setSnoozedUntil(OFF_DEFAULTS.snoozedUntil);
    }
  }, [userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  const enable = useCallback(() => {
    if (!SHADOW_MODE_FEATURE_ENABLED) return;
    try {
      setShadowModeEnabled(userDb, true);
    } catch {
      // best-effort; refetch reflects actual persisted state either way
    }
    refetch();
  }, [userDb, refetch]);

  const disable = useCallback(() => {
    if (!SHADOW_MODE_FEATURE_ENABLED) return;
    try {
      setShadowModeEnabled(userDb, false);
    } catch {
      // best-effort
    }
    refetch();
  }, [userDb, refetch]);

  const dismissPrompt = useCallback(() => {
    if (!SHADOW_MODE_FEATURE_ENABLED) return;
    try {
      setShadowModePromptDismissed(userDb, true);
    } catch {
      // best-effort
    }
    refetch();
  }, [userDb, refetch]);

  const snoozePrompt = useCallback(() => {
    if (!SHADOW_MODE_FEATURE_ENABLED) return;
    try {
      const until = new Date(Date.now() + SHADOW_MODE_SNOOZE_DAYS * MS_PER_DAY);
      setShadowModePromptSnoozedUntil(userDb, until.toISOString());
    } catch {
      // best-effort
    }
    refetch();
  }, [userDb, refetch]);

  const daysActive = enabledAt
    ? Math.floor((Date.now() - enabledAt.getTime()) / MS_PER_DAY)
    : 0;

  const isSnoozedNow = snoozedUntil !== null && Date.now() < snoozedUntil.getTime();

  const shouldShowSwitchPrompt =
    SHADOW_MODE_FEATURE_ENABLED &&
    isEnabled &&
    daysActive >= SHADOW_MODE_SWITCH_PROMPT_DAYS &&
    !dismissed &&
    !isSnoozedNow;

  return {
    isFeatureEnabled: SHADOW_MODE_FEATURE_ENABLED,
    canEnable: SHADOW_MODE_FEATURE_ENABLED && canEnable,
    isEnabled: SHADOW_MODE_FEATURE_ENABLED && isEnabled,
    enabledAt,
    daysActive,
    shouldShowSwitchPrompt,
    enable,
    disable,
    dismissPrompt,
    snoozePrompt,
    refetch,
  };
}
