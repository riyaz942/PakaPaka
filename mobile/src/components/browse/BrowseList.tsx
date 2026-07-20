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
  onEndReached: () => void;
  onSelectItem: (id: string) => void;
  onSelectPassage: (id: string) => void;
  onClearFilters: () => void;
  canClearFilters: boolean;
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
  onEndReached,
  onSelectItem,
  onSelectPassage,
  onClearFilters,
  canClearFilters,
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
    [onSelectItem, onSelectPassage],
  );

  if (loading) {
    return (
      <View className="mt-space-2xl items-center">
        <ActivityIndicator accessibilityLabel="Loading results" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1"
      testID="browse-list"
      data={rows}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
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
  );
}
