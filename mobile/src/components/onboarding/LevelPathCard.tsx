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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      className={cn(
        'min-h-[44px] rounded-radius-md bg-surface p-4',
        selected ? 'border-2 border-feedback-info' : 'border border-border',
        accentBorder && !selected && 'border-2 border-feedback-info',
      )}>
      <Text className={cn('text-body font-semibold', accentBorder && 'text-feedback-info')}>
        {title}
      </Text>
      <Text className="mt-1 text-body-sm text-secondary">{description}</Text>

      {badge ? (
        <View className="mt-2 self-start rounded-radius-sm bg-feedback-correct/15 px-2 py-1">
          <Text className="text-caption text-feedback-correct">{badge}</Text>
        </View>
      ) : null}

      {children}
    </Pressable>
  );
}
