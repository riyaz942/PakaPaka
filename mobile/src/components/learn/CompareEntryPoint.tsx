import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useItemLinkBase } from '@/components/learn/ItemLinkContext';

/**
 * "Compare with…" entry from item details (FR80, AC #4).
 *
 * Only rendered on the Browse details surface: inside a review the same body is
 * mounted under `/review/item`, and pushing a `/browse/*` route from there
 * would leave the review Stack and destroy the session. The review surface
 * already reaches Compare through the answer-collision link in `AnswerReveal`.
 */
export function CompareEntryPoint({ itemId }: { itemId: string }) {
  const base = useItemLinkBase();

  if (base !== '/browse/item') {
    return null;
  }

  return (
    <View className="mt-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compare this item with another"
        onPress={() => router.push({ pathname: '/browse/compare', params: { left: itemId } })}
        testID="compare-entry-point"
        className="min-h-[44px] justify-center rounded-radius-md border border-border bg-surface px-3 py-2">
        <Text className="text-body text-feedback-info">Compare with…</Text>
      </Pressable>
    </View>
  );
}
