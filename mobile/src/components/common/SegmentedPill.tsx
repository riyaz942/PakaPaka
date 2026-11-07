import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useHaptics } from '@/data/hooks/useHaptics';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
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

const SLIDE_MS = 200;

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
  const { reducedMotion } = useReducedMotion();
  const { play: playHaptic } = useHaptics();
  // The jade marker is one shape that slides between segments. Until every
  // segment has been measured, the selected segment paints its own fill.
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const selectedLayout = layouts[value];
  const markerX = useSharedValue(0);
  const markerWidth = useSharedValue(0);
  const [markerReady, setMarkerReady] = useState(false);

  useEffect(() => {
    if (!selectedLayout) return;
    const animate = markerReady && !reducedMotion;
    markerX.value = animate ? withTiming(selectedLayout.x, { duration: SLIDE_MS }) : selectedLayout.x;
    markerWidth.value = animate
      ? withTiming(selectedLayout.width, { duration: SLIDE_MS })
      : selectedLayout.width;
    if (!markerReady) setMarkerReady(true);
  }, [selectedLayout, markerReady, reducedMotion, markerX, markerWidth]);

  const markerStyle = useAnimatedStyle(() => ({
    left: markerX.value,
    width: markerWidth.value,
  }));

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
      {markerReady ? (
        <Animated.View
          pointerEvents="none"
          className="absolute bottom-[3px] top-[3px] rounded-radius-full bg-brand-600"
          style={markerStyle}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => {
              if (!selected) playHaptic('selection');
              onChange(option.value);
            }}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              setLayouts((current) => ({ ...current, [option.value]: layout }));
            }}
            hitSlop={SEGMENT_HIT_SLOP}
            testID={option.testID}
            className={cn(
              'items-center justify-center rounded-radius-full px-[11px] py-[6px]',
              expand && 'min-w-0 flex-1',
              selected && !markerReady && 'bg-brand-600',
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
