import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components/common/Banner';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { initialGoalForIntensity } from '@/core/cognitive-load/thresholdCalculator';
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

  const dailyGoal = initialGoalForIntensity(selectedIntensity ?? 'relaxed');

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
            Your daily goal at this pace:{' '}
            <Text className="font-ui-extrabold text-primary">{dailyGoal} items</Text>
            {importPath ? ' — layered on top of your imported progress.' : '.'}
          </Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn index={2}>
        <Banner
          visible
          variant="info"
          message="This sets your daily goal, not a hard cap — reviews grow on top of it as you learn."
          className="mt-space-sm"
          testID="intensity-reviews-note"
        />
      </FadeSlideIn>
    </OnboardingStep>
  );
}
