import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
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

    if (completed) {
      return;
    }

    const level = getStartingJlptLevel(userDb);
    const intensity = getSessionIntensity(userDb);
    const segmentList = segments as string[];
    const inOnboarding = segmentList[0] === 'onboarding';
    const onWelcome = inOnboarding && segmentList[1] === 'welcome';
    const onIntensity = inOnboarding && segmentList[1] === 'intensity';
    const onCalibrate = inOnboarding && segmentList[1] === 'calibrate';
    const onBulk = inOnboarding && segmentList[1] === 'bulk';
    const onComplete = inOnboarding && segmentList[1] === 'complete';

    if (!level) {
      if (!inOnboarding) {
        router.replace('/onboarding/welcome');
      }
      return;
    }

    if (!intensity) {
      if (!onIntensity) {
        router.replace('/onboarding/intensity');
      }
      return;
    }

    if (!onCalibrate && !onWelcome && !onIntensity && !onBulk && !onComplete) {
      if (!inOnboarding || segmentList[1] === 'import') {
        router.replace('/onboarding/calibrate');
      }
    }
  }, [userDb, segments, navigationState?.key]);
}
