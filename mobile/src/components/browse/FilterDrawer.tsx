import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import {
  BROWSE_FACET_LABELS,
  BROWSE_FACET_OPTIONS,
  facetValueLabel,
  type BrowseFacetKey,
} from '@/core/browse/browseFilters';
import { useSheetFrame } from '@/hooks/useWideLayout';
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
  /** True while the count runs: Apply shows a loader and the drawer's buttons do not respond. */
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
  const sheetFrame = useSheetFrame();
  const options = BROWSE_FACET_OPTIONS[facet];
  // Disabled at a zero result count (FR64), and while a recount is in flight
  // so the learner cannot apply against a stale count.
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
        className={cn('flex-1 bg-black/40', sheetFrame.backdropClassName)}
      />
      <View
        className={cn(
          'gap-space-md rounded-t-radius-xl border-t border-border bg-surface p-space-lg shadow-e3',
          sheetFrame.className,
        )}
        style={sheetFrame.style}>
        <View className="h-1 w-10 self-center rounded-radius-full bg-border" />
        <View className="flex-row items-center justify-between">
          <Text className="text-title font-ui-bold text-primary">{BROWSE_FACET_LABELS[facet]}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${BROWSE_FACET_LABELS[facet]} selection`}
            accessibilityState={{ disabled: isCounting }}
            disabled={isCounting}
            onPress={onClear}
            testID={`browse-filter-clear-${facet}`}
            className="min-h-[44px] justify-center">
            <Text className="text-body-sm font-ui-semibold text-brand-text">Clear</Text>
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
                accessibilityState={{ checked: isSelected, disabled: isCounting }}
                accessibilityLabel={facetValueLabel(facet, value)}
                disabled={isCounting}
                onPress={() => onToggle(value)}
                testID={`browse-filter-option-${facet}-${value}`}
                className={cn(
                  'min-h-[44px] justify-center rounded-radius-md px-space-md',
                  isSelected
                    ? 'border-2 border-brand-500 bg-brand-soft'
                    : 'border border-border bg-background',
                )}>
                <Text
                  className={cn(
                    'text-body font-ui',
                    isSelected ? 'font-ui-semibold text-brand-text' : 'text-primary',
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
            isCounting
              ? 'Counting results'
              : count === 0
                ? 'No matches for this selection'
                : `Apply filters, ${count} results`
          }
          accessibilityState={{ disabled: applyDisabled, busy: isCounting }}
          disabled={applyDisabled}
          onPress={onApply}
          testID={`browse-filter-apply-${facet}`}
          className={cn(
            'min-h-[48px] items-center justify-center rounded-radius-md',
            applyDisabled ? 'bg-surface-elevated' : 'bg-brand-600',
          )}>
          {isCounting ? (
            <ActivityIndicator testID={`browse-filter-counting-${facet}`} />
          ) : (
            <Text
              className={cn(
                'text-body font-ui-semibold',
                applyDisabled ? 'text-faint' : 'text-on-primary',
              )}>
              {`Apply (${count})`}
            </Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}
