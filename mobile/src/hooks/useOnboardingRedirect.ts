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

    const level = getStartingJlptLevel(userDb);
    const intensity = getSessionIntensity(userDb);
    const inOnboarding = segmentList[0] === 'onboarding';
    const currentStep = segmentList[1];
    const onWelcome = inOnboarding && currentStep === 'welcome';
    const onIntensity = inOnboarding && currentStep === 'intensity';
    const onPlacement = inOnboarding && currentStep === 'placement';
    const onComplete = inOnboarding && currentStep === 'complete';
    const onImport = inOnboarding && currentStep === 'import';
    const onImportSummary = inOnboarding && currentStep === 'import-summary';
    const onImportBranch = onImport || onImportSummary;
    const importPath = isImportOnboardingPath(userDb);

    if (!level) {
      if (!inOnboarding) {
        router.replace('/onboarding/welcome');
      }
      return;
    }

    if (!intensity) {
      const mayStayOnWelcome = onWelcome && isPendingImportBranch(userDb);
      if (!onIntensity && !onImportBranch && !mayStayOnWelcome) {
        router.replace('/onboarding/intensity');
      }
      return;
    }

    if (importPath) {
      const allowedSteps = new Set([
        'intensity',
        'complete',
        'import',
        'import-summary',
      ]);
      if (!inOnboarding || (currentStep && !allowedSteps.has(currentStep))) {
        router.replace('/onboarding/complete');
      }
      return;
    }

    // Beginner path skips placement — there is nothing below N5 to calibrate.
    const manualPath = getOnboardingPath(userDb) === 'manual';
    if (!manualPath) {
      if (!onWelcome && !onIntensity && !onComplete && !onImportBranch) {
        router.replace('/onboarding/complete');
      }
      return;
    }

    if (!onPlacement && !onWelcome && !onIntensity && !onComplete && !onImportBranch) {
      router.replace('/onboarding/placement');
    }
  }, [userDb, segments, navigationState?.key]);
}
