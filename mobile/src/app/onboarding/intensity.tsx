import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components/common/Banner';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { LESSON_SIZE_BY_INTENSITY } from '@/core/lesson/lessonPlanner';
import { useDatabase } from '@/data/hooks/useDatabase';
import { isImportOnboardingPath } from '@/data/user/onboardingPathUtils';
import { getOnboardingPath, setSessionIntensity } from '@/data/user/preferencesRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export default function IntensityScreen() {
  const { userDb } = useDatabase();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>('relaxed');
  // Answers a different question than the routing branch below: it also counts
  // imported rows when the preference is unset, and only drives preview copy.
  const importPath = isImportOnboardingPath(userDb);
  const onboardingPath = getOnboardingPath(userDb);

  const lessonSize = LESSON_SIZE_BY_INTENSITY[selectedIntensity ?? 'relaxed'];

  const handleContinue = () => {
    if (!selectedIntensity) {
      return;
    }

    setSessionIntensity(userDb, selectedIntensity);

    if (onboardingPath === 'manual') {
      router.push('/onboarding/placement');
      return;
    }
    // Absolute beginners get the day-1 deck; importers already know the ropes.
    if (onboardingPath === 'beginner') {
      router.push('/onboarding/day-one');
      return;
    }
    router.push('/onboarding/complete');
  };

  return (
    <OnboardingStep
      title="Set your daily pace"
      description="Each day you'll get one auto-built lesson plus your reviews. You can change this anytime in Settings."
      stepIndex={2}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: handleContinue,
        disabled: !selectedIntensity,
      }}>
      <FadeSlideIn index={0}>
        <SessionIntensityPicker
          selectedIntensity={selectedIntensity}
          onSelect={setSelectedIntensity}
          testID="session-intensity-picker"
        />
      </FadeSlideIn>

      <FadeSlideIn index={1}>
        <View
          className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md py-space-sm"
          testID="intensity-lesson-preview">
          <Text className="text-body-sm font-ui-medium text-secondary">
            Today&apos;s lesson at this pace:{' '}
            <Text className="font-ui-extrabold text-primary">{lessonSize} new items</Text>
            {importPath ? ' — layered on top of your imported progress.' : '.'}
          </Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Banner
          visible
          variant="info"
          message="Reviews grow as you learn — pace only controls new items."
          className="mt-space-sm"
          testID="intensity-reviews-note"
        />
      </FadeSlideIn>
    </OnboardingStep>
  );
}
