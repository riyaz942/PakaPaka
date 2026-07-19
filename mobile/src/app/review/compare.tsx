import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { ScreenHeader } from '@/components/common/ScreenHeader';

/**
 * Compare route stub (Story 1.2 / FR86) — CONTRACT LOCKED FOR STORY 4.2.
 *
 * Route: `review/compare` (nested in the review Stack so the answer-collision
 * link never leaves the session — `ReviewSessionProvider` must not remount).
 *
 * Search params (both required strings — Story 4.2 must keep these names):
 * - `left`  = the item id of the card being reviewed
 * - `right` = the colliding item id (whose accepted answer the user typed)
 *
 * Story 4.2 replaces this body with the full Compare UI (sticky glyphs,
 * chips) without changing the deep-link shape. Do not build that here.
 */
export default function ReviewCompareScreen() {
  const { left, right } = useLocalSearchParams<{ left: string; right: string }>();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Compare"
        backTestID="review-compare-back"
        backAccessibilityLabel="Back to review"
      />
      <View className="flex-1 items-center justify-center gap-space-sm px-space-lg">
        <Text className="text-title text-primary">Compare coming soon</Text>
        <Text className="text-body text-secondary text-center" testID="review-compare-params">
          Side-by-side comparison for items {left ?? '?'} and {right ?? '?'} arrives with the
          full Compare view.
        </Text>
      </View>
    </View>
  );
}
