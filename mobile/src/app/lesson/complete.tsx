import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { SessionCompleteHeader } from '@/components/common/SessionCompleteHeader';
import { MaxContentWidth } from '@/constants/theme';
import { setReviewPriority } from '@/data/reviewPriorityStore';

export default function LessonCompleteScreen() {
  const params = useLocalSearchParams<{ count?: string; itemIds?: string }>();
  const count = Math.max(0, Number(params.count) || 0);
  const itemWord = count === 1 ? 'new item' : 'new items';
  const sessionItemIds = params.itemIds
    ? decodeURIComponent(params.itemIds).split(',').filter(Boolean)
    : [];

  const handleQuizMeNow = () => {
    setReviewPriority({ itemIds: sessionItemIds, limit: null });
    router.replace('/review');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View
        className="w-full flex-1 self-center px-space-md"
        style={{ maxWidth: MaxContentWidth }}>
        <View className="flex-1 items-center justify-center gap-space-md">
          <SessionCompleteHeader
            title={count > 0 ? `${count} ${itemWord} learned` : 'Lesson complete'}
            caption="They're in your review queue now."
            testID="lesson-complete-title"
            mascot="goal-achieved"
          />

          <FadeSlideIn index={2}>
            <Text className="text-center text-body text-secondary">
              Quiz me now tests only what you just learned, while it&apos;s fresh.
            </Text>
          </FadeSlideIn>
        </View>

        <View className="gap-space-sm pb-space-md">
          <Button label="Quiz me now" onPress={handleQuizMeNow} testID="lesson-complete-quiz" />
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
