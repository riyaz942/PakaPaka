import React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

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
        <Text className="text-title font-ui-bold text-primary">{"Couldn't load"}</Text>
        <Text className="text-center text-body text-secondary">{error}</Text>
        {onRetry ? (
          <Button
            label="Try again"
            accessibilityLabel="Retry loading browse results"
            onPress={onRetry}
            testID="browse-error-retry"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="mt-space-2xl items-center gap-space-md px-space-lg" testID="browse-empty">
      <Text className="text-title font-ui-bold text-primary">No matches</Text>
      <Text className="text-center text-body text-secondary">
        {canClear
          ? 'Nothing here fits those filters. Try widening them.'
          : 'There is nothing to browse yet.'}
      </Text>
      {canClear ? (
        <Button
          label="Clear filters"
          accessibilityLabel="Clear all filters and search"
          onPress={onClearFilters}
          testID="browse-empty-clear"
        />
      ) : null}
    </View>
  );
}
