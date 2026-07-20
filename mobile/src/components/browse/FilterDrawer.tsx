import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import {
  BROWSE_FACET_LABELS,
  BROWSE_FACET_OPTIONS,
  facetValueLabel,
  type BrowseFacetKey,
} from '@/core/browse/browseFilters';
import { cn } from '@/utils/cn';

type FilterDrawerProps = {
  facet: BrowseFacetKey;
  visible: boolean;
  /** Draft selection — not applied until Apply is pressed. */
  selected: readonly string[];
  onToggle: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onDismiss: () => void;
  /** Live count of rows the draft selection would produce (FR64). */
  count: number;
  isCounting: boolean;
};

/**
 * Multi-select facet drawer with a live result count (FR64). Apply is disabled
 * at zero so the learner can never commit a filter that empties the list — the
 * count tells them before they tap, not after.
 */
export function FilterDrawer({
  facet,
  visible,
  selected,
  onToggle,
  onApply,
  onClear,
  onDismiss,
  count,
  isCounting,
}: FilterDrawerProps) {
  const options = BROWSE_FACET_OPTIONS[facet];
  const applyDisabled = count === 0 || isCounting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID={`browse-filter-drawer-${facet}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss filters"
        onPress={onDismiss}
        className="flex-1 bg-black/40"
      />
      <View className="gap-space-md rounded-t-radius-lg border-t border-border bg-surface p-space-lg">
        <View className="flex-row items-center justify-between">
          <Text className="text-title text-primary">{BROWSE_FACET_LABELS[facet]}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${BROWSE_FACET_LABELS[facet]} selection`}
            onPress={onClear}
            testID={`browse-filter-clear-${facet}`}
            className="min-h-[44px] justify-center">
            <Text className="text-body-sm text-secondary">Clear</Text>
          </Pressable>
        </View>

        <View
          accessibilityRole="list"
          accessibilityLabel={`${BROWSE_FACET_LABELS[facet]} options`}
          className="flex-row flex-wrap gap-space-sm">
          {options.map((value) => {
            const isSelected = selected.includes(value);
            return (
              <Pressable
                key={value}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={facetValueLabel(facet, value)}
                onPress={() => onToggle(value)}
                testID={`browse-filter-option-${facet}-${value}`}
                className={cn(
                  'min-h-[44px] justify-center rounded-radius-md px-space-md',
                  isSelected
                    ? 'border-2 border-feedback-info bg-surface-elevated'
                    : 'border border-border bg-background',
                )}>
                <Text
                  className={cn(
                    'text-body',
                    isSelected ? 'font-semibold text-feedback-info' : 'text-primary',
                  )}>
                  {facetValueLabel(facet, value)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            count === 0 ? 'No matches for this selection' : `Apply filters, ${count} results`
          }
          accessibilityState={{ disabled: applyDisabled }}
          disabled={applyDisabled}
          onPress={onApply}
          testID={`browse-filter-apply-${facet}`}
          className={cn(
            'min-h-[48px] items-center justify-center rounded-radius-md',
            applyDisabled ? 'bg-surface-elevated' : 'bg-feedback-info',
          )}>
          <Text
            className={cn(
              'text-body font-semibold',
              applyDisabled ? 'text-secondary' : 'text-background',
            )}>
            {isCounting ? 'Apply' : `Apply (${count})`}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
