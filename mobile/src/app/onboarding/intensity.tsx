import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

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
  const importPath = isImportOnboardingPath(userDb);
  const manualPath = getOnboardingPath(userDb) === 'manual';

  const lessonSize = LESSON_SIZE_BY_INTENSITY[selectedIntensity ?? 'relaxed'];

  const handleContinue = () => {
    if (!selectedIntensity) {
      return;
    }

    setSessionIntensity(userDb, selectedIntensity);
    router.push(manualPath ? '/onboarding/placement' : '/onboarding/complete');
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
          className="mt-4 rounded-radius-md border border-border bg-surface px-4 py-3"
          testID="intensity-lesson-preview">
          <Text className="text-body-sm text-secondary">
            Today&apos;s lesson at this pace:{' '}
            <Text className="font-semibold text-primary">{lessonSize} new items</Text>
            {importPath ? ' — layered on top of your imported progress.' : '.'}
          </Text>
        </View>
      </FadeSlideIn>
    </OnboardingStep>
  );
}
