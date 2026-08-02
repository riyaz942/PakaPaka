import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { SessionCompleteHeader } from '@/components/common/SessionCompleteHeader';
import { MaxContentWidth } from '@/constants/theme';

export default function LessonCompleteScreen() {
  const params = useLocalSearchParams<{ count?: string }>();
  const count = Math.max(0, Number(params.count) || 0);
  const itemWord = count === 1 ? 'new item' : 'new items';

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
          />

          <FadeSlideIn index={2}>
            <Text className="text-center text-body text-secondary">
              A quick quiz while they&apos;re fresh locks them in.
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
