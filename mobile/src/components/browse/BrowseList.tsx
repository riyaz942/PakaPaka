import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { BrowseEmptyState } from '@/components/browse/BrowseEmptyState';
import { BrowseRow } from '@/components/browse/BrowseRow';
import { PassageBrowseRow } from '@/components/browse/PassageBrowseRow';
import type { BrowseRowModel } from '@/data/curriculum/browseRepository';

type BrowseListProps = {
  rows: BrowseRowModel[];
  loading: boolean;
  loadingMore: boolean;
  error?: string | null;
  onEndReached: () => void;
  onSelectItem: (id: string) => void;
  onSelectPassage: (id: string) => void;
  onClearFilters: () => void;
  canClearFilters: boolean;
  onRetry?: () => void;
  /** Passages that opened since Browse was last seen. */
  newlyUnlockedPassageIds?: ReadonlySet<string>;
};

/**
 * The flat Browse list (FR62): one virtualized surface holding items and
 * reading passages together, with JLPT level as a filter rather than a level of
 * navigation.
 *
 * RN's `FlatList` with explicit paging is the deliberate choice for this story —
 * FlashList waits on the New Architecture migration in Epic 5.
 */
export function BrowseList({
  rows,
  loading,
  loadingMore,
  error = null,
  onEndReached,
  onSelectItem,
  onSelectPassage,
  onClearFilters,
  canClearFilters,
  onRetry,
  newlyUnlockedPassageIds,
}: BrowseListProps) {
  const keyExtractor = useCallback(
    (row: BrowseRowModel) => `${row.kind}:${row.id}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row }: { item: BrowseRowModel }) =>
      row.kind === 'passage' ? (
        <PassageBrowseRow
          row={row}
          justUnlocked={newlyUnlockedPassageIds?.has(row.id)}
          onPress={() => onSelectPassage(row.id)}
          testID={`browse-passage-${row.id}`}
        />
      ) : (
        <BrowseRow
          row={row}
          onPress={() => onSelectItem(row.id)}
          testID={`browse-item-${row.id}`}
        />
      ),
    [newlyUnlockedPassageIds, onSelectItem, onSelectPassage],
  );

  if (loading) {
    return (
      <View className="mt-space-2xl items-center">
        <ActivityIndicator accessibilityLabel="Loading results" />
      </View>
    );
  }

  if (error && rows.length === 0) {
    return (
      <BrowseEmptyState
        onClearFilters={onClearFilters}
        canClear={false}
        error={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <View
      // The spec holds the whole result set in one bordered card. It only reads
      // as a card when there is something in it, so an empty list drops the frame.
      className={
        rows.length > 0
          ? 'flex-1 overflow-hidden rounded-radius-md border border-border'
          : 'flex-1'
      }>
      <FlatList
        className="flex-1"
        testID="browse-list"
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={newlyUnlockedPassageIds}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <BrowseEmptyState onClearFilters={onClearFilters} canClear={canClearFilters} />
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-space-lg items-center">
              <ActivityIndicator accessibilityLabel="Loading more results" />
            </View>
          ) : null
        }
      />
    </View>
  );
}
