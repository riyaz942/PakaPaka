import React from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components/common/Banner';
import { Icon } from '@/components/common/Icon';
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
        className="mb-space-md flex-row items-start gap-space-sm rounded-radius-md bg-feedback-warning-soft px-space-md py-space-sm"
        testID="study-status-banner">
        <Icon
          name="locked"
          size={18}
          strokeWidth={2}
          className="mt-[2px] text-feedback-warning-deep"
        />
        <View className="flex-1">
          <Text className="text-body-sm font-ui-semibold text-feedback-warning-deep">
            Study these first to unlock this item:
          </Text>
          <View className="mt-[2px] flex-row flex-wrap gap-space-sm">
            {unmetPrerequisites.map((parent) => (
              <Text
                key={parent.id}
                className="text-body font-jp-medium text-feedback-warning-deep">
                {parent.primaryForm}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (status === 'in_progress' || status === 'known') {
    return null;
  }

  return (
    <Banner
      className="mb-space-md"
      message="You haven't studied this yet."
      variant="info"
      visible
      testID="study-status-banner"
    />
  );
}
