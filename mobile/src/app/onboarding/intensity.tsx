import { router } from 'expo-router';
import React, { useState } from 'react';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setSessionIntensity } from '@/data/user/preferencesRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export default function IntensityScreen() {
  const { userDb } = useDatabase();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>('relaxed');

  const handleContinue = () => {
    if (!selectedIntensity) {
      return;
    }

    setSessionIntensity(userDb, selectedIntensity);
    router.replace('/onboarding/calibrate');
  };

  return (
    <OnboardingStep
      title="How much time can you study?"
      description="You can change this anytime in Settings."
      stepIndex={2}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: handleContinue,
        disabled: !selectedIntensity,
      }}>
      <SessionIntensityPicker
        selectedIntensity={selectedIntensity}
        onSelect={setSelectedIntensity}
        testID="session-intensity-picker"
      />
    </OnboardingStep>
  );
}
