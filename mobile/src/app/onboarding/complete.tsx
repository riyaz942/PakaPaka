import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { Text, View } from 'react-native';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { Icon, type IconName } from '@/components/common/Icon';
import { OnboardingStep } from '@/components/common/OnboardingStep';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setOnboardingCompleted } from '@/data/user/preferencesRepository';
import { cn } from '@/utils/cn';

/**
 * v2 uses no emoji in UI, so each value prop gets a drawn icon on a soft square
 * in its own hue: the lesson book in radical blue, the weakness target in kanji
 * pink, the device in jade.
 */
const HIGHLIGHTS = [
  {
    icon: 'lesson',
    tile: 'bg-content-radical-soft',
    glyph: 'text-content-radical',
    title: 'One lesson a day',
    body: 'Built for you automatically — radicals, kanji, vocab, and grammar in the right order.',
  },
  {
    icon: 'weakness',
    tile: 'bg-content-kanji-soft',
    glyph: 'text-content-kanji',
    title: 'Reviews that adapt',
    body: 'Spaced repetition tuned to your weak spots, not a fixed schedule.',
  },
  {
    icon: 'device',
    tile: 'bg-brand-soft',
    glyph: 'text-brand-text',
    title: 'Yours, offline',
    body: 'Everything lives on this device. No account, no subscription, no waiting.',
  },
] as const satisfies readonly {
  icon: IconName;
  tile: string;
  glyph: string;
  title: string;
  body: string;
}[];

export default function CompleteScreen() {
  const { userDb } = useDatabase();
  const { restored } = useLocalSearchParams<{ restored?: string }>();
  // A restored learner already has a queue and a history — "start your first
  // lesson" would be wrong, and a lesson is optional for them (Story 9.2 AC8).
  const isRestored = restored === '1';
  const submittedRef = useRef(false);

  const finish = useCallback(
    (destination: '/lesson' | '/dashboard') => {
      if (submittedRef.current) {
        return;
      }
      submittedRef.current = true;
      setOnboardingCompleted(userDb);
      // Land on the tab shell first so closing a lesson never pops to an
      // empty stack (which exits the app on Android).
      router.replace('/dashboard');
      if (destination === '/lesson') {
        router.push('/lesson');
      }
    },
    [userDb],
  );

  return (
    <OnboardingStep
      title={isRestored ? "You're back" : "You're ready"}
      description={
        isRestored
          ? 'Your backup is restored. Your reviews are waiting exactly where you left them.'
          : 'Your path is set. The fastest way to make it stick? Learn something right now.'
      }
      stepIndex={4}
      stepCount={4}
      primaryAction={
        isRestored
          ? { label: 'Continue learning', onPress: () => finish('/dashboard') }
          : { label: 'Start your first lesson', onPress: () => finish('/lesson') }
      }
      secondaryAction={
        isRestored
          ? { label: 'Start a lesson', onPress: () => finish('/lesson') }
          : { label: 'Explore on my own', onPress: () => finish('/dashboard') }
      }
      testID="complete-screen">
      <View className="gap-space-sm">
        {HIGHLIGHTS.map((highlight, index) => (
          <FadeSlideIn key={highlight.title} index={index}>
            <View className="flex-row items-center gap-space-md rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
              <View
                className={cn(
                  'h-10 w-10 items-center justify-center rounded-radius-sm',
                  highlight.tile,
                )}>
                <Icon name={highlight.icon} size={21} strokeWidth={1.9} className={highlight.glyph} />
              </View>
              <View className="flex-1">
                <Text className="text-body font-ui-extrabold text-primary">{highlight.title}</Text>
                <Text className="mt-[3px] text-body-sm font-ui text-muted">{highlight.body}</Text>
              </View>
            </View>
          </FadeSlideIn>
        ))}
      </View>
    </OnboardingStep>
  );
}
