import React from 'react';
import { Pressable, Text, View } from 'react-native';

type BrowseEmptyStateProps = {
  onClearFilters: () => void;
  /** Hidden when nothing is filtering — an empty curriculum needs no clear action. */
  canClear: boolean;
};

/**
 * Browse zero-results state (UX-DR30). An invitation to widen the search, not a
 * dead end and not a scolding — the way out is the first thing offered.
 */
export function BrowseEmptyState({ onClearFilters, canClear }: BrowseEmptyStateProps) {
  return (
    <View className="mt-space-2xl items-center gap-space-md px-space-lg" testID="browse-empty">
      <Text className="text-title text-primary">No matches</Text>
      <Text className="text-center text-body text-secondary">
        {canClear
          ? 'Nothing here fits those filters. Try widening them.'
          : 'There is nothing to browse yet.'}
      </Text>
      {canClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all filters and search"
          onPress={onClearFilters}
          testID="browse-empty-clear"
          className="min-h-[48px] justify-center rounded-radius-md bg-feedback-info px-space-lg">
          <Text className="text-body font-semibold text-background">Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
