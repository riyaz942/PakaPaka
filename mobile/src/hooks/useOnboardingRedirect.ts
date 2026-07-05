import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect } from 'react';

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

export function useOnboardingRedirect(): void {
  const { userDb } = useDatabase();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    const completed = isOnboardingCompleted(userDb);
    const segmentList = segments as string[];

    if (completed) {
      const inOnboarding = segmentList[0] === 'onboarding';
      if (inOnboarding) {
        router.replace('/(tabs)');
      }
      return;
    }

    // While onboarding is incomplete, the user may stand on ANY onboarding
    // step — earlier steps stay reachable so back navigation works. Only
    // redirect when the user is outside onboarding entirely.
    const inOnboarding = segmentList[0] === 'onboarding';
    if (inOnboarding) {
      return;
    }

    const level = getStartingJlptLevel(userDb);
    const intensity = getSessionIntensity(userDb);
    const importPath = isImportOnboardingPath(userDb);

    if (!level) {
      router.replace('/onboarding/welcome');
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
  }, [userDb, segments, navigationState?.key]);
}
