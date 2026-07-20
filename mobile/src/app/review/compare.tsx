import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { CompareView } from '@/components/common/CompareView';
import { ScreenHeader } from '@/components/common/ScreenHeader';

/**
 * Compare route (Story 1.2 / FR86, body filled in by Story 4.2) — CONTRACT LOCKED.
 *
 * Route: `review/compare` (nested in the review Stack so the answer-collision
 * link never leaves the session — `ReviewSessionProvider` must not remount).
 *
 * Search params (both required strings — do not rename):
 * - `left`  = the item id of the card being reviewed
 * - `right` = the colliding item id (whose accepted answer the user typed)
 *
 * The comparison UI itself lives in `components/common/CompareView`, shared
 * with the Browse entry point (`(tabs)/browse/compare`) so the two surfaces
 * cannot drift — and so Browse never has to push a `review/*` route.
 */
function paramString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function ReviewCompareScreen() {
  const params = useLocalSearchParams<{ left?: string | string[]; right?: string | string[] }>();
  const left = paramString(params.left);
  const right = paramString(params.right);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Compare"
        backTestID="review-compare-back"
        backAccessibilityLabel="Back to review"
      />
      <CompareView leftId={left} rightId={right} />
    </View>
  );
}
