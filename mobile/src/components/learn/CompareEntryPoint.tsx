import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useItemLinkBase } from '@/components/learn/ItemLinkContext';
import type { ItemType } from '@/data/curriculum/itemRepository';

/**
 * "Compare with…" entry from item details (FR80, AC #4).
 *
 * Only rendered on the Browse details surface: inside a review the same body is
 * mounted under `/review/item`, and pushing a `/browse/*` route from there
 * would leave the review Stack and destroy the session. The review surface
 * already reaches Compare through the answer-collision link in `AnswerReveal`.
 *
 * Not offered for grammar — grammar has no comparable siblings, so it neither
 * shows this entry nor is searchable as a candidate on the other end.
 */
export function CompareEntryPoint({
  itemId,
  itemType,
}: {
  itemId: string;
  itemType: ItemType;
}) {
  const base = useItemLinkBase();

  if (base !== '/browse/item' || itemType === 'grammar') {
    return null;
  }

  return (
    <View className="mt-space-lg">
      <Button
        label="Compare with…"
        variant="secondary"
        accessibilityLabel="Compare this item with another"
        onPress={() =>
          router.push({ pathname: '/browse/compare', params: { left: itemId, leftType: itemType } })
        }
        testID="compare-entry-point"
      />
    </View>
  );
}
