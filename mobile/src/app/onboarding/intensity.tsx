import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { Button } from '@/components/common/Button';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { useDatabase } from '@/data/hooks/useDatabase';
import { isImportOnboardingPath } from '@/data/user/onboardingPathUtils';
import { setSessionIntensity } from '@/data/user/preferencesRepository';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export default function IntensityScreen() {
  const { userDb } = useDatabase();
  const [selectedIntensity, setSelectedIntensity] = useState<SessionIntensity | null>('relaxed');
  const importPath = isImportOnboardingPath(userDb);

  const handleContinue = () => {
    if (!selectedIntensity) {
      return;
    }

    setSessionIntensity(userDb, selectedIntensity);
    router.replace(importPath ? '/onboarding/complete' : '/onboarding/calibrate');
  };

  const handleMarkManually = () => {
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
      {importPath ? (
        <View className="mt-4">
          <Button
            disabled={!selectedIntensity}
            label="Mark items manually"
            onPress={handleMarkManually}
            testID="mark-items-manually"
            variant="secondary"
          />
          <Text className="mt-2 text-body text-secondary">
            Optional — your import already set SRS progress for matched items.
          </Text>
        </View>
      ) : null}
    </OnboardingStep>
  );
}
