import React from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { cn } from '@/utils/cn';

type ContentPlaceholderNoticeProps = {
  label: string;
  testID?: string;
  className?: string;
};

/**
 * Dashed "not authored yet" notice for curriculum text content, the text
 * sibling of the radical illustration's own dashed placeholder
 * (`LessonMnemonicImageSlot`'s "Illustration coming soon" box).
 */
export function ContentPlaceholderNotice({ label, testID, className }: ContentPlaceholderNoticeProps) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      testID={testID}
      className={cn(
        'mt-space-xs flex-row items-center gap-space-sm rounded-radius-lg border-[1.5px] border-dashed border-border bg-surface px-space-md py-space-sm',
        className,
      )}>
      <Icon name="passage" size={20} strokeWidth={1.8} className="text-faint" />
      <Text className="flex-1 text-body-sm font-ui-semibold text-faint">{label}</Text>
    </View>
  );
}
