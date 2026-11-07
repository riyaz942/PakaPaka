import React from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/common/Icon';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import { useFeedbackMotion } from '@/hooks/useFeedbackMotion';
import { cn } from '@/utils/cn';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FilterPillProps = {
  label: string;
  /** True once the facet has a selection — the pill then summarizes itself. */
  active?: boolean;
  onPress: () => void;
  /** When present, renders an inline clear affordance for this facet. */
  onClear?: () => void;
  testID?: string;
};

/**
 * Facet entry point and applied-filter pill in one (FR64, UX-DR30). An inactive
 * pill reads as the facet name ("Level"); an active one summarizes what it is
 * doing ("Vocab + Grammar") so the filter bar never needs a separate legend.
 */
export function FilterPill({ label, active, onPress, onClear, testID }: FilterPillProps) {
  const { reducedMotion } = useReducedMotion();
  // A small bounce each time the pill turns on.
  const popStyle = useFeedbackMotion('pop', active ? 1 : 0);

  return (
    <Animated.View
      style={popStyle}
      className={cn(
        'flex-row items-center rounded-radius-full border',
        // Active is a solid jade fill with a white label; inactive is a plain
        // outlined pill (spec, Search & filter chips).
        active ? 'border-brand-600 bg-brand-600' : 'border-border bg-surface',
      )}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={active ? `Filter: ${label}. Edit` : `Filter by ${label}`}
        accessibilityState={{ selected: Boolean(active) }}
        onPress={onPress}
        testID={testID}
        className="min-h-[44px] justify-center px-space-md">
        <Text
          className={cn(
            'text-body-sm font-ui-bold',
            active ? 'text-on-primary' : 'text-secondary',
          )}>
          {label}
        </Text>
      </Pressable>

      {active && onClear ? (
        <AnimatedPressable
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label} filter`}
          onPress={onClear}
          testID={testID ? `${testID}-clear` : undefined}
          className="min-h-[44px] min-w-[44px] items-center justify-center pr-space-sm">
          <Icon name="close" size={14} strokeWidth={2.6} className="text-on-primary" />
        </AnimatedPressable>
      ) : null}
    </Animated.View>
  );
}
