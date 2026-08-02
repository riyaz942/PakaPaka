import React from 'react';
import { Text } from 'react-native';

import { cn } from '@/utils/cn';

type ScreenTitleProps = {
  children: string;
  className?: string;
  testID?: string;
};

/**
 * The title at the top of a tab screen — 28px extra-bold ink, the heaviest type
 * in the app outside a hero glyph. Stack detail screens use `ScreenHeader`
 * instead, which sizes its title to sit in a 56px bar.
 */
export function ScreenTitle({ children, className, testID }: ScreenTitleProps) {
  return (
    <Text
      accessibilityRole="header"
      testID={testID}
      className={cn('text-title-lg font-ui-extrabold text-primary', className)}>
      {children}
    </Text>
  );
}
