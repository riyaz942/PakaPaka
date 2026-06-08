import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setOnboardingCompleted } from '@/data/user/preferencesRepository';

export default function CompleteScreen() {
  const { userDb } = useDatabase();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoToHome = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setOnboardingCompleted(userDb);
    router.replace('/(tabs)');
  }, [isSubmitting, userDb]);

  return (
    <OnboardingStep
      title="You're all set"
      description="Your level and study preferences are saved locally. No account needed."
      stepIndex={4}
      stepCount={4}
      primaryAction={{
        label: 'Go to Home',
        onPress: handleGoToHome,
      }}
      testID="complete-screen">
      <View className="gap-4">
        <View
          accessibilityRole="text"
          testID="complete-success-banner"
          className="flex-row items-center gap-2 rounded-radius-md border border-feedback-correct bg-feedback-correct/10 px-4 py-3">
          <Text className="text-body font-semibold text-feedback-correct">✓</Text>
          <Text className="flex-1 text-body font-semibold text-feedback-correct">
            Setup complete
          </Text>
        </View>

        <Text className="text-body-sm text-secondary">
          Head to Home to explore the app. Your first review session ships in a later update.
        </Text>
      </View>
    </OnboardingStep>
  );
}
