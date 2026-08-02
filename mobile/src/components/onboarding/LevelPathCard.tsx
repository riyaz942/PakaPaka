import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type LevelPathCardProps = {
  title: string;
  description: string;
  selected?: boolean;
  badge?: string;
  accentBorder?: boolean;
  onPress: () => void;
  testID?: string;
  children?: React.ReactNode;
};

/**
 * Onboarding's "pick a path" card. It looks like a `ChoiceCard` but stays a
 * button: two of the three paths navigate on press rather than sitting in a
 * radiogroup waiting for Continue.
 *
 * `accentBorder` is the spec's highlighted-but-unchosen state (the import card),
 * drawn the same as selected so the eye lands on it first.
 */
export function LevelPathCard({
  title,
  description,
  selected = false,
  badge,
  accentBorder = false,
  onPress,
  testID,
  children,
}: LevelPathCardProps) {
  const highlighted = selected || accentBorder;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      className={cn(
        'min-h-[44px] rounded-radius-lg p-space-md',
        highlighted
          ? 'border-2 border-brand-500 bg-brand-soft'
          : 'border border-border bg-surface shadow-e1',
      )}>
      <Text
        className={cn(
          'text-body font-ui-extrabold',
          highlighted ? 'text-brand-text' : 'text-primary',
        )}>
        {title}
      </Text>
      <Text
        className={cn(
          'mt-space-xs text-body-sm font-ui',
          highlighted ? 'text-secondary' : 'text-muted',
        )}>
        {description}
      </Text>

      {badge ? (
        <View className="mt-space-sm self-start rounded-radius-full bg-brand-soft-strong px-space-sm py-[5px]">
          <Text className="text-overline font-ui-bold text-brand-text">{badge}</Text>
        </View>
      ) : null}

      {children}
    </Pressable>
  );
}
