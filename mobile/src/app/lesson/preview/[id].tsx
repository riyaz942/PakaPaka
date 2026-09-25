import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { LessonSessionHeader } from '@/components/common/LessonSessionHeader';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { LESSON_SECTION_COUNT } from '@/components/lesson/LessonItemSections';
import { LessonItemView } from '@/components/lesson/LessonItemView';
import { MaxContentWidth } from '@/constants/theme';
import { safeBack } from '@/utils/safeBack';

/**
 * Developer-only: pages one item's lesson cards without a lesson session, so
 * lesson content can be checked for an item already learned (the planner never
 * offers a started item again). Writes nothing — no SRS state, goal ring or
 * streak. Renders nothing in release builds.
 */
export default function LessonPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sectionIndex, setSectionIndex] = useState(0);

  if (!__DEV__ || !id) {
    return null;
  }

  const isLastSection = sectionIndex === LESSON_SECTION_COUNT - 1;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full flex-1 self-center" style={{ maxWidth: MaxContentWidth }}>
        <LessonSessionHeader
          current={sectionIndex + 1}
          total={LESSON_SECTION_COUNT}
          onExitPress={safeBack}
          exitAccessibilityLabel="Close preview"
          testID="lesson-preview-header"
        />

        <View className="flex-1 px-space-md">
          <ScrollView className="mt-space-sm flex-1" contentContainerClassName="pb-space-lg">
            <ItemLinkProvider base="/lesson/item">
              <LessonItemView itemId={id} sectionIndex={sectionIndex} />
            </ItemLinkProvider>
          </ScrollView>

          <View className="flex-row gap-space-sm pb-space-md pt-space-sm">
            <Button
              label="Back"
              variant="tertiary"
              onPress={() => setSectionIndex(sectionIndex - 1)}
              disabled={sectionIndex === 0}
              testID="lesson-preview-back"
              className="w-[96px] px-space-sm"
            />
            <Button
              label={isLastSection ? 'Close preview' : 'Continue'}
              onPress={isLastSection ? safeBack : () => setSectionIndex(sectionIndex + 1)}
              testID="lesson-preview-next"
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
