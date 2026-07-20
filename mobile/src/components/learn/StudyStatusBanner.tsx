import React from 'react';
import { Text, View } from 'react-native';

import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

type StudyStatusBannerProps = {
  status: StudyStatus;
  isLocked: boolean;
  unmetPrerequisites: CurriculumParentItem[];
};

/**
 * Passive orientation for the item you are looking at (FR76).
 *
 * | State                            | Banner                        |
 * | -------------------------------- | ----------------------------- |
 * | Locked (unmet prerequisites)     | what is still needed          |
 * | Prerequisites met, `not_started` | "You haven't studied this yet"|
 * | `in_progress` / `known`          | nothing                       |
 *
 * Informational only: no CTA, no lesson entry point, and it never hides or
 * dims the content below it. Viewing an item is not the same as being eligible
 * to study it, and details must never gate reading (BUG7).
 */
export function StudyStatusBanner({
  status,
  isLocked,
  unmetPrerequisites,
}: StudyStatusBannerProps) {
  // Lock orientation wins over study-status quiet — a locked item that somehow
  // already has progress still needs to name what is unmet.
  if (isLocked && unmetPrerequisites.length > 0) {
    return (
      <View
        className="mt-4 rounded-radius-md border border-border bg-surface px-space-md py-space-sm"
        testID="study-status-banner">
        <Text className="text-body-sm text-secondary">
          Study these first to unlock this item:
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-space-sm">
          {unmetPrerequisites.map((parent) => (
            <Text key={parent.id} className="text-body text-primary">
              {parent.primaryForm}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  if (status === 'in_progress' || status === 'known') {
    return null;
  }

  return (
    <View
      className="mt-4 rounded-radius-md border border-border bg-surface px-space-md py-space-sm"
      testID="study-status-banner">
      <Text className="text-body-sm text-secondary">You haven&apos;t studied this yet.</Text>
    </View>
  );
}
