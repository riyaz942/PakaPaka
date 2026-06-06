import React from 'react';
import { Text } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';

export default function CompletePlaceholderScreen() {
  return (
    <OnboardingStep
      title="Finishing setup"
      description="Finishing setup — coming next"
      stepIndex={4}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: () => {},
        disabled: true,
      }}
      testID="complete-placeholder-screen">
      <Text className="text-body text-secondary">
        Story 2.5 will complete onboarding and open the main app.
      </Text>
    </OnboardingStep>
  );
}
