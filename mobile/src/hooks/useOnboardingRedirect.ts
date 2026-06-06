import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
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

    const level = getStartingJlptLevel(userDb);
    const completed = isOnboardingCompleted(userDb);

    if (completed) {
      return;
    }

    const segmentList = segments as string[];
    const inOnboarding = segmentList[0] === 'onboarding';
    const onIntensity = inOnboarding && segmentList[1] === 'intensity';

    if (!level) {
      if (!inOnboarding) {
        router.replace('/onboarding/welcome');
      }
      return;
    }

    if (!onIntensity) {
      router.replace('/onboarding/intensity');
    }
  }, [userDb, segments, navigationState?.key]);
}
