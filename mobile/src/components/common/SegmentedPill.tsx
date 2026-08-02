import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type SegmentedPillOption<T extends string> = {
  value: T;
  label: string;
  testID?: string;
};

type SegmentedPillProps<T extends string> = {
  options: readonly SegmentedPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive tech, e.g. "Theme". */
  accessibilityLabel: string;
  disabled?: boolean;
  className?: string;
  testID?: string;
};

/**
 * The spec's segmented pill: a surface-elevated track holding one jade-filled
 * segment. Used where a short, mutually exclusive set reads better inline than
 * as stacked choice cards (Settings → Theme, import → source).
 *
 * The spec draws 26px-tall segments; each one here is a 44px tap target instead,
 * which the a11y floor requires.
 */
export function SegmentedPill<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  className,
  testID,
}: SegmentedPillProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className={cn(
        'flex-row rounded-radius-full bg-surface-elevated p-[3px]',
        disabled && 'opacity-50',
        className,
      )}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            testID={option.testID}
            className={cn(
              'min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-radius-full px-space-sm',
              selected && 'bg-brand-600',
            )}>
            <Text
              className={cn(
                'text-caption font-ui-bold',
                selected ? 'text-on-primary' : 'text-muted',
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
