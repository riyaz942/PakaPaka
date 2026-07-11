import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { StreakCelebration } from '@/components/engagement';
import { MaxContentWidth } from '@/constants/theme';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import { useStreakCelebration } from '@/data/hooks/useStreakCelebration';

export default function LessonCompleteScreen() {
  const params = useLocalSearchParams<{ count?: string }>();
  const count = Math.max(0, Number(params.count) || 0);
  const { reducedMotion } = useReducedMotion();
  const { shouldCelebrate, currentStreak } = useStreakCelebration();

  const emblem = (
    <View className="h-24 w-24 items-center justify-center rounded-radius-full bg-feedback-correct/15">
      <Text className="text-display">🌱</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View
        className="w-full flex-1 self-center px-space-lg"
        style={{ maxWidth: MaxContentWidth }}>
        <View className="flex-1 items-center justify-center gap-space-md">
          {shouldCelebrate ? (
            <StreakCelebration streakCount={currentStreak} />
          ) : reducedMotion ? (
            emblem
          ) : (
            <Animated.View entering={ZoomIn.springify().damping(12)}>{emblem}</Animated.View>
          )}

          <FadeSlideIn index={1}>
            <Text className="text-center text-title-lg text-primary" testID="lesson-complete-title">
              {count > 0 ? `${count} new items planted` : 'Lesson complete'}
            </Text>
          </FadeSlideIn>

          <FadeSlideIn index={2}>
            <Text className="text-center text-body text-secondary">
              They&apos;re in your review queue now. A quick quiz while they&apos;re fresh
              locks them in.
            </Text>
          </FadeSlideIn>
        </View>

        <View className="gap-space-sm pb-space-md">
          <Button
            label="Quiz me now"
            onPress={() => router.replace('/review')}
            testID="lesson-complete-quiz"
          />
          <Button
            label="Done for today"
            variant="ghost"
            onPress={() => router.replace('/(tabs)')}
            testID="lesson-complete-done"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
