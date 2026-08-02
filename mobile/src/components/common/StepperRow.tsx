import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type StepperRowProps = {
  label: string;
  description?: string;
  value: number;
  onValueChange: (value: number) => void;
  step?: number;
  min?: number;
  /** Omit for settings with no upper limit — the daily goal has none. */
  max?: number;
  /** Suffix read out with the value, e.g. "load units". */
  unitLabel?: string;
  testID?: string;
};

/**
 * Settings stepper row: −/value/+ in a surface-elevated capsule. Each button is
 * a 44px tap target and disables itself at the bound rather than clamping
 * silently, so the limit is visible rather than felt.
 */
export function StepperRow({
  label,
  description,
  value,
  onValueChange,
  step = 1,
  min = 0,
  max,
  unitLabel,
  testID,
}: StepperRowProps) {
  const canDecrease = value - step >= min;
  const canIncrease = max === undefined || value + step <= max;
  const spokenValue = unitLabel ? `${value} ${unitLabel}` : `${value}`;

  return (
    <View className="min-h-[56px] flex-row items-center gap-space-md py-space-sm" testID={testID}>
      <View className="flex-1">
        <Text className="text-body font-ui-semibold text-primary">{label}</Text>
        {description ? (
          <Text className="mt-[3px] text-caption font-ui-medium text-muted">{description}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center overflow-hidden rounded-radius-sm border border-border bg-surface-elevated">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => onValueChange(value - step)}
          testID={testID ? `${testID}-decrement` : undefined}
          className="h-[44px] w-[44px] items-center justify-center">
          <Text className={cn('text-title font-ui-bold', canDecrease ? 'text-brand-text' : 'text-faint')}>
            −
          </Text>
        </Pressable>

        <Text
          accessibilityLabel={`${label}: ${spokenValue}`}
          testID={testID ? `${testID}-value` : undefined}
          className="w-[52px] text-center text-body font-ui-extrabold text-primary">
          {value}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => onValueChange(value + step)}
          testID={testID ? `${testID}-increment` : undefined}
          className="h-[44px] w-[44px] items-center justify-center">
          <Text className={cn('text-title font-ui-bold', canIncrease ? 'text-brand-text' : 'text-faint')}>
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
