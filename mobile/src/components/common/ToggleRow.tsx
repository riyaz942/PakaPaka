import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type ToggleRowProps = {
  label: string;
  /** One line explaining what the setting does — the spec always carries one. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Settings toggle row: label and explanation on the left, a 48×28 pill switch
 * on the right (jade when on, surface-elevated when off). Built from a
 * `Pressable` with `accessibilityRole="switch"` rather than the platform
 * `Switch` so the knob follows the v2 palette on both platforms.
 */
export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
}: ToggleRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      testID={testID}
      className={cn(
        'min-h-[56px] flex-row items-center gap-space-md py-space-sm',
        disabled && 'opacity-50',
      )}>
      <View className="flex-1">
        <Text className="text-body font-ui-semibold text-primary">{label}</Text>
        {description ? (
          <Text className="mt-[3px] text-caption font-ui-medium text-muted">{description}</Text>
        ) : null}
      </View>

      <View
        testID={testID ? `${testID}-track` : undefined}
        className={cn(
          'h-[28px] w-[48px] justify-center rounded-radius-full p-[3px]',
          value ? 'bg-brand-600' : 'border border-border bg-surface-elevated',
        )}>
        <View
          className={cn(
            'h-[22px] w-[22px] rounded-radius-full',
            value ? 'self-end bg-on-primary' : 'self-start bg-faint',
          )}
        />
      </View>
    </Pressable>
  );
}
