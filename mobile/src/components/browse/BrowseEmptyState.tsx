import React from 'react';
import { Pressable, Text, View } from 'react-native';

type BrowseEmptyStateProps = {
  onClearFilters: () => void;
  /** Hidden when nothing is filtering — an empty curriculum needs no clear action. */
  canClear: boolean;
  /** Distinct from zero matches: the list query failed. */
  error?: string | null;
  onRetry?: () => void;
};

/**
 * Browse zero-results state (UX-DR30). An invitation to widen the search, not a
 * dead end and not a scolding — the way out is the first thing offered.
 */
export function BrowseEmptyState({
  onClearFilters,
  canClear,
  error = null,
  onRetry,
}: BrowseEmptyStateProps) {
  if (error) {
    return (
      <View className="mt-space-2xl items-center gap-space-md px-space-lg" testID="browse-error">
        <Text className="text-title text-primary">{"Couldn't load"}</Text>
        <Text className="text-center text-body text-secondary">{error}</Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading browse results"
            onPress={onRetry}
            testID="browse-error-retry"
            className="min-h-[48px] justify-center rounded-radius-md bg-feedback-info px-space-lg">
            <Text className="text-body font-semibold text-background">Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

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
