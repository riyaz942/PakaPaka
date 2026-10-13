import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ItemDetailBody } from '@/components/learn/ItemDetailBody';
import { ItemDetailHeaderBar } from '@/components/learn/ItemDetailHeaderBar';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { MaxContentWidth } from '@/constants/theme';
import { parseInflection } from '@/core/content/inflection';

/**
 * Full item detail reached from the review answer reveal (FR85). Mounted as a
 * nested screen inside the review Stack so `ReviewSessionProvider` (owned by
 * `review/_layout.tsx`) never remounts — Back returns to the same card with
 * the session intact.
 *
 * `ItemLinkProvider` keeps every cross-reference chip on `/review/item/[id]`:
 * pushing a Browse route from here would leave the review stack and destroy
 * the session.
 */
export default function ReviewItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string; surface?: string; inflection?: string }>();
  const itemId = params.id ?? null;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader backTestID="review-item-back" backAccessibilityLabel="Back to review">
        <ItemDetailHeaderBar itemId={itemId} />
      </ScreenHeader>
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
          testID="review-item-scroll">
          <ItemLinkProvider base="/review/item">
            <ItemDetailBody
              itemId={itemId}
              surface={params.surface ?? null}
              inflection={parseInflection(params.inflection)}
              inReview
            />
          </ItemLinkProvider>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
