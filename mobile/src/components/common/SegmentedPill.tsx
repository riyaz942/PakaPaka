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
  /**
   * Stretch the track to the parent width and share space evenly across
   * segments (import source, furigana override). Leave off for inline use
   * next to a label (Settings → Theme) so the pill sizes to its labels.
   */
  expand?: boolean;
  className?: string;
  testID?: string;
};

/** Expand each segment's hit box to the 44px floor without growing the drawn track. */
const SEGMENT_HIT_SLOP = { top: 9, bottom: 9, left: 4, right: 4 };

/**
 * The spec's segmented pill: a surface-elevated track holding one jade-filled
 * segment. Used where a short, mutually exclusive set reads better inline than
 * as stacked choice cards (Settings → Theme, import → source).
 *
 * Drawn at the spec's ~26px segment height; each Pressable keeps a ≥44px tap
 * target via hitSlop so the a11y floor still clears.
 */
export function SegmentedPill<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  expand = false,
  className,
  testID,
}: SegmentedPillProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className={cn(
        'flex-row items-center gap-[2px] rounded-radius-full bg-surface-elevated p-[3px]',
        expand ? 'w-full' : 'self-start',
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
            hitSlop={SEGMENT_HIT_SLOP}
            testID={option.testID}
            className={cn(
              'items-center justify-center rounded-radius-full px-[11px] py-[6px]',
              expand && 'min-w-0 flex-1',
              selected && 'bg-brand-600',
            )}>
            <Text
              className={cn(
                'text-caption font-ui-bold',
                selected ? 'text-on-primary' : 'text-muted',
              )}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
