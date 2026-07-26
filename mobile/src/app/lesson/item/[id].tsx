import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ItemDetailBody } from '@/components/learn/ItemDetailBody';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { MaxContentWidth } from '@/constants/theme';

/**
 * Full item detail reached from a lesson (Plan 11.7). Mounted as a nested
 * screen inside the lesson Stack so the lesson card (item/section index)
 * never remounts — Back returns to the same card with progress intact.
 *
 * `ItemLinkProvider` keeps every cross-reference chip on `/lesson/item/[id]`:
 * pushing a Browse route from here would leave the lesson stack.
 */
export default function LessonItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = params.id ?? null;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader backTestID="lesson-item-back" backAccessibilityLabel="Back to lesson" />
      <SafeAreaView
        edges={['left', 'right']}
        className="flex-1"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-space-lg pt-space-md pb-space-2xl"
          showsVerticalScrollIndicator
          testID="lesson-item-scroll">
          <ItemLinkProvider base="/lesson/item">
            <ItemDetailBody itemId={itemId} />
          </ItemLinkProvider>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
