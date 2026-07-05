import { router } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setOnboardingCompleted } from '@/data/user/preferencesRepository';

const HIGHLIGHTS = [
  {
    icon: '📖',
    title: 'One lesson a day',
    body: 'Built for you automatically — radicals, kanji, vocab, and grammar in the right order.',
  },
  {
    icon: '🔁',
    title: 'Reviews that adapt',
    body: 'Spaced repetition tuned to your weak spots, not a fixed schedule.',
  },
  {
    icon: '📴',
    title: 'Yours, offline',
    body: 'Everything lives on this device. No account, no subscription, no waiting.',
  },
] as const;

export default function CompleteScreen() {
  const { userDb } = useDatabase();
  const submittedRef = useRef(false);

  const finish = useCallback(
    (destination: '/lesson' | '/(tabs)') => {
      if (submittedRef.current) {
        return;
      }
      submittedRef.current = true;
      setOnboardingCompleted(userDb);
      // Land on the tab shell first so closing a lesson never pops to an
      // empty stack (which exits the app on Android).
      router.replace('/(tabs)');
      if (destination === '/lesson') {
        router.push('/lesson');
      }
    },
    [userDb],
  );

  return (
    <OnboardingStep
      title="You're ready 🎉"
      description="Your path is set. The fastest way to make it stick? Learn something right now."
      stepIndex={4}
      stepCount={4}
      primaryAction={{
        label: 'Start your first lesson',
        onPress: () => finish('/lesson'),
      }}
      secondaryAction={{
        label: 'Explore on my own',
        onPress: () => finish('/(tabs)'),
      }}
      testID="complete-screen">
      <View className="gap-3">
        {HIGHLIGHTS.map((highlight, index) => (
          <FadeSlideIn key={highlight.title} index={index}>
            <View className="flex-row items-start gap-3 rounded-radius-md border border-border bg-surface p-4">
              <Text className="text-title">{highlight.icon}</Text>
              <View className="flex-1">
                <Text className="text-body font-semibold text-primary">
                  {highlight.title}
                </Text>
                <Text className="mt-1 text-body-sm text-secondary">{highlight.body}</Text>
              </View>
            </View>
          </FadeSlideIn>
        ))}
      </View>
    </OnboardingStep>
  );
}
