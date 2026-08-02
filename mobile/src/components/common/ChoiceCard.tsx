import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type ChoiceCardProps = {
  title: string;
  /** Supporting line — "~15 min/day", "Import from WaniKani". */
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Adds the jade "Recommended" / "Most popular" pill. */
  badgeLabel?: string;
  /** Extra content inside the card (e.g. the import card's source pills). */
  children?: React.ReactNode;
  className?: string;
  testID?: string;
};

/**
 * Onboarding and Settings choice card. Selected is a 2px jade border on a
 * brand-50 wash; unselected is a plain outlined surface. Selection is announced
 * through `accessibilityState`, never by colour alone.
 */
export function ChoiceCard({
  title,
  description,
  selected,
  onPress,
  badgeLabel,
  children,
  className,
  testID,
}: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={onPress}
      testID={testID}
      className={cn(
        'min-h-[44px] rounded-radius-lg p-space-md',
        selected ? 'border-2 border-brand-500 bg-brand-soft' : 'border border-border bg-surface',
        className,
      )}>
      <Text className="text-body font-ui-extrabold text-primary">{title}</Text>

      {description ? (
        <Text className="mt-space-xs text-body-sm font-ui-medium text-secondary">
          {description}
        </Text>
      ) : null}

      {badgeLabel ? (
        <View className="mt-space-sm self-start rounded-radius-full bg-brand-soft-strong px-space-sm py-[5px]">
          <Text className="text-overline font-ui-bold text-brand-text">{badgeLabel}</Text>
        </View>
      ) : null}

      {children}
    </Pressable>
  );
}
