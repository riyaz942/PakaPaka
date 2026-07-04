import { router, type Href } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { LessonItemView } from '@/components/lesson/LessonItemView';
import { MaxContentWidth } from '@/constants/theme';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLessonPlan } from '@/data/hooks/useLessonPlan';
import { startLessonItems } from '@/data/user/lessonProgressRepository';

/**
 * Auto-generated lesson session: walks the planned items one at a time.
 * Nothing is committed until the final item — leaving mid-lesson costs nothing.
 */
export default function LessonScreen() {
  const { userDb } = useDatabase();
  const { items, level, isLoading } = useLessonPlan();
  const [index, setIndex] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = items[index] ?? null;
  const isLast = index === items.length - 1;

  const handleNext = () => {
    if (!isLast) {
      setIndex((value) => value + 1);
      return;
    }

    const result = startLessonItems(
      userDb,
      items.map((item) => item.id),
    );
    if (!result.ok) {
      setSaveError(result.error.userMessage ?? result.error.message);
      return;
    }
    router.replace(`/lesson/complete?count=${items.length}` as Href);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="Building your lesson" />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Nothing new today</Text>
          <Text className="text-body text-secondary">
            You&apos;ve started everything available{level ? ` at ${level}` : ''}. Clear
            some reviews and new items will unlock.
          </Text>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View
        className="w-full flex-1 self-center px-space-lg pt-space-md"
        style={{ maxWidth: MaxContentWidth }}>
        <View className="flex-row items-center gap-space-md">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close lesson"
            onPress={() => router.back()}
            testID="lesson-close"
            className="min-h-[44px] min-w-[44px] items-start justify-center">
            <Text className="text-title text-secondary">✕</Text>
          </Pressable>

          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Item ${index + 1} of ${items.length}`}
            className="h-2 flex-1 overflow-hidden rounded-radius-full bg-border">
            <View
              className="h-full rounded-radius-full bg-feedback-info"
              style={{ width: `${((index + 1) / items.length) * 100}%` }}
            />
          </View>

          <Text className="text-body-sm text-secondary" testID="lesson-progress-label">
            {index + 1}/{items.length}
          </Text>
        </View>

        {current ? (
          <FadeSlideIn key={current.id} className="flex-1">
            <ScrollView
              className="mt-space-md flex-1"
              contentContainerClassName="pb-space-lg">
              <LessonItemView itemId={current.id} />
            </ScrollView>
          </FadeSlideIn>
        ) : null}

        {saveError ? (
          <Text className="mb-space-sm text-body-sm text-feedback-incorrect">
            {saveError}
          </Text>
        ) : null}

        <View className="pb-space-md">
          <Button
            label={isLast ? 'Finish lesson' : 'Got it — next'}
            onPress={handleNext}
            testID="lesson-next"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
