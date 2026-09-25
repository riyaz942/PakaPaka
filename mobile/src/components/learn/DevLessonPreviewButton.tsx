import { router, type Href } from 'expo-router';
import React from 'react';

import { Button } from '@/components/common/Button';

/**
 * Developer-only: opens this item's lesson cards in a preview that writes
 * nothing, so lesson content can be checked on a device even for an item
 * already learned. Never rendered in release builds.
 */
export function DevLessonPreviewButton({ itemId }: { itemId: string }) {
  if (!__DEV__) {
    return null;
  }

  return (
    <Button
      className="mt-space-md self-start"
      variant="secondary"
      label="Dev: preview lesson cards"
      onPress={() => router.push(`/lesson/preview/${itemId}` as Href)}
      testID="dev-lesson-preview"
    />
  );
}
