import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';

import { cn } from '@/utils/cn';

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
  return (
    <View
      className={cn(
        'flex-row items-center rounded-radius-full border',
        active ? 'border-feedback-info bg-surface-elevated' : 'border-border bg-surface',
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
            'text-body-sm font-semibold',
            active ? 'text-feedback-info' : 'text-secondary',
          )}>
          {label}
        </Text>
      </Pressable>

      {active && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label} filter`}
          onPress={onClear}
          testID={testID ? `${testID}-clear` : undefined}
          className="min-h-[44px] min-w-[44px] items-center justify-center pr-space-sm">
          <MaterialIcons name="close" size={16} className="text-feedback-info" />
        </Pressable>
      ) : null}
    </View>
  );
}
