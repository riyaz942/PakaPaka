import React from 'react';
import { Text, View } from 'react-native';

import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import { type ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type ContentTypeBadgeProps = {
  itemType: ItemType;
  testID?: string;
  className?: string;
};

/** Small pill that names an item's content type in its accent color. */
export function ContentTypeBadge({ itemType, testID, className }: ContentTypeBadgeProps) {
  const accent = CONTENT_TYPE_ACCENT[itemType];
  return (
    <View
      testID={testID}
      className={cn('self-start rounded-radius-full px-space-sm py-[2px]', accent.tint, className)}>
      <Text className={cn('text-overline font-semibold', accent.text)}>
        {CONTENT_TYPE_LABEL[itemType].toUpperCase()}
      </Text>
    </View>
  );
}
