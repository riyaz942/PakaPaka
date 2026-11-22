import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  isImportOnboardingPath,
  isPendingImportBranch,
} from '@/data/user/onboardingPathUtils';
import {
  getOnboardingPath,
  getSessionIntensity,
  getStartingJlptLevel,
  isOnboardingCompleted,
} from '@/data/user/preferencesRepository';
import { isWeb } from '@/platform/capabilities';

/**
 * `appliedVersion` comes from the sync: a pull can write the account's progress
 * (onboarding completed included) while the learner stays on one screen, so the
 * check runs again each time it goes up.
 *
 * While `hold` is true (the wait for the first sync after a sign-in) nothing redirects. When the
 * hold ends and onboarding is completed, the dashboard opens wherever the learner stands: the web
 * sign-in returns to settings, not to an onboarding screen.
 */
export function useOnboardingRedirect(appliedVersion = 0, hold = false): void {
  const { userDb } = useDatabase();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const previousHold = useRef(hold);

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    const holdEnded = previousHold.current && !hold;
    previousHold.current = hold;
    if (hold) {
      return;
    }

    const completed = isOnboardingCompleted(userDb);
    const segmentList = segments as string[];
    // The phone's start screen (after a sign-out) is the door to onboarding, so it counts as inside.
    const inOnboarding = segmentList[0] === 'onboarding' || segmentList[0] === 'start';

    if (completed) {
      if (inOnboarding || holdEnded) {
        router.replace('/dashboard');
      }
      return;
    }

    // While onboarding is incomplete, the user may stand on ANY onboarding
    // step — earlier steps stay reachable so back navigation works. Only
    // redirect when the user is outside onboarding entirely.
    if (inOnboarding) {
      return;
    }

    const level = getStartingJlptLevel(userDb);
    const intensity = getSessionIntensity(userDb);
    const importPath = isImportOnboardingPath(userDb);

    if (!level) {
      // The phone's first screen is the start page; the web has its own landing page.
      router.replace(isWeb() ? '/onboarding/welcome' : '/start');
      return;
    }

    if (!intensity) {
      if (isPendingImportBranch(userDb)) {
        router.replace('/onboarding/welcome');
      } else {
        router.replace('/onboarding/intensity');
      }
      return;
    }

    if (importPath) {
      router.replace('/onboarding/complete');
      return;
    }

    // Beginner path skips placement — there is nothing below N5 to calibrate.
    const manualPath = getOnboardingPath(userDb) === 'manual';
    router.replace(manualPath ? '/onboarding/placement' : '/onboarding/complete');
  }, [userDb, segments, navigationState?.key, appliedVersion, hold]);
}
