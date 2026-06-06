import React from 'react';
import { Text } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';

export default function BulkPlaceholderScreen() {
  return (
    <OnboardingStep
      title="Bulk marking"
      description="Bulk marking — coming next"
      stepIndex={4}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: () => {},
        disabled: true,
      }}
      testID="bulk-placeholder-screen">
      <Text className="text-body text-secondary">
        Story 2.4 will add bulk mark-known controls here.
      </Text>
    </OnboardingStep>
  );
}
