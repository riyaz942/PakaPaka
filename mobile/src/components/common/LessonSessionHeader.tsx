import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type LessonSessionHeaderProps = {
  /** 1-based position of the item on screen. */
  current: number;
  total: number;
  /** Tints the progress bar with the item's type, as the spec's lesson does. */
  itemType?: ItemType;
  onExitPress: () => void;
  exitAccessibilityLabel?: string;
  testID?: string;
};

/**
 * Lesson session header: close affordance, a progress bar in the current item's
 * content-type colour, and the position counter. The whole strip is one
 * accessibility node so a screen reader reads "3 of 5" rather than walking a
 * decorative bar.
 */
export function LessonSessionHeader({
  current,
  total,
  itemType,
  onExitPress,
  exitAccessibilityLabel = 'End lesson',
  testID,
}: LessonSessionHeaderProps) {
  const fillClass = itemType ? CONTENT_TYPE_ACCENT[itemType].edge : 'bg-brand-500';
  const fraction = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;

  return (
    <View className="h-[56px] flex-row items-center gap-space-md px-space-md" testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={exitAccessibilityLabel}
        onPress={onExitPress}
        testID={testID ? `${testID}-exit` : undefined}
        className="min-h-[44px] min-w-[44px] items-center justify-center">
        <Icon name="close" size={22} strokeWidth={2} className="text-muted" />
      </Pressable>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Lesson item ${current} of ${total}`}
        accessibilityValue={{ min: 0, max: total, now: current }}
        className="h-2 flex-1 overflow-hidden rounded-radius-full bg-surface-elevated">
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={{ width: `${fraction * 100}%` }}
          className={cn('h-full rounded-radius-full', fillClass)}
        />
      </View>

      <Text className="text-body-sm font-ui-bold text-muted">{`${current}/${total}`}</Text>
    </View>
  );
}
