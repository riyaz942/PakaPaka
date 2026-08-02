import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { MaxContentWidth } from '@/constants/theme';

type ScreenHeaderProps = {
  title?: string;
  backAccessibilityLabel?: string;
  backTestID?: string;
  onBack?: () => void;
};

/**
 * Coloured header bar for stack-style detail screens (headerShown: false shell).
 * Fills the top safe-area inset so the OS status bar sits on a surface,
 * and hosts the icon back affordance.
 */
export function ScreenHeader({
  title,
  backAccessibilityLabel = 'Back',
  backTestID,
  onBack,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="border-b border-border bg-surface" style={{ paddingTop: insets.top }}>
      <View
        className="flex-row items-center px-space-md"
        style={{ alignSelf: 'center', maxWidth: MaxContentWidth, width: '100%' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          onPress={onBack ?? (() => router.back())}
          testID={backTestID}
          className="min-h-[44px] min-w-[44px] items-start justify-center py-1"
          hitSlop={8}>
          <Icon name="back" size={24} strokeWidth={2} className="text-primary" />
        </Pressable>
        {title ? (
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="flex-1 pr-space-md text-title font-ui-bold text-primary">
            {title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
