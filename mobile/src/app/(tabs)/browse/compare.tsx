import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { CompareView } from '@/components/common/CompareView';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { EMPTY_BROWSE_FILTERS } from '@/core/browse/browseFilters';
import { ITEM_TYPES, type ItemType } from '@/data/curriculum/itemRepository';
import { useBrowseItems } from '@/data/hooks/useBrowseItems';

/** Compare has no grammar side (FR80): grammar has no comparable siblings. */
const COMPARABLE_TYPES = ITEM_TYPES.filter((type): type is ItemType => type !== 'grammar');

/**
 * Compare from Browse details (FR80, AC #4).
 *
 * A sibling of `review/compare` rather than a shared push target: every
 * `review/*` route is wrapped in `ReviewSessionProvider` (`review/_layout.tsx`),
 * which must not mount outside an active review. Both routes render the same
 * `CompareView`, so only the entry differs.
 *
 * Params match the locked review contract (`left` / `right`). Arriving with
 * only `left` opens the picker for the second item.
 */
function paramString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Minimal second-item picker — reuses Browse's search, not its filter drawer.
 *
 * Search only runs when the learner presses Search: querying on every
 * keystroke was slow enough to be felt. The type facet is pinned to the item
 * type Compare was opened from (radical/kanji/vocabulary only — grammar is
 * never a candidate), so the picker never surfaces a mismatched type.
 */
function ComparePicker({ leftId, leftType }: { leftId: string; leftType?: ItemType }) {
  const { rows, loading, setSearchInput, applyFilters } = useBrowseItems();
  const [queryText, setQueryText] = useState('');

  useEffect(() => {
    applyFilters({
      ...EMPTY_BROWSE_FILTERS,
      types: leftType ? [leftType] : [...COMPARABLE_TYPES],
    });
  }, [applyFilters, leftType]);

  const candidates = rows
    .filter((row) => row.kind === 'item' && row.id !== leftId)
    .slice(0, 30);

  const runSearch = () => setSearchInput(queryText);

  return (
    <View className="flex-1 px-space-lg pt-space-md">
      <Text className="text-body text-secondary">Choose a second item to compare against.</Text>

      <View className="mt-space-md flex-row items-center gap-space-sm">
        <TextInput
          value={queryText}
          onChangeText={setQueryText}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          placeholder="Search items"
          accessibilityLabel="Search items to compare"
          testID="compare-picker-search"
          className="min-h-[44px] flex-1 rounded-radius-md border border-border bg-surface px-3 text-body text-primary"
        />
        <Button
          label="Search"
          variant="secondary"
          onPress={runSearch}
          testID="compare-picker-search-button"
        />
      </View>

      <View className="mt-space-md flex-1" testID="compare-picker-list">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator accessibilityLabel="Searching" />
          </View>
        ) : candidates.length === 0 ? (
          <Text className="text-body text-secondary">No matching items.</Text>
        ) : (
          <ScrollView contentContainerClassName="pb-space-2xl" keyboardShouldPersistTaps="handled">
            {candidates.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={`Compare with ${row.kind === 'item' ? row.primaryForm : ''}`}
                onPress={() => router.setParams({ left: leftId, right: row.id })}
                testID={`compare-picker-item-${row.id}`}
                className="min-h-[44px] justify-center border-b border-border py-space-sm">
                <Text className="text-body text-primary">
                  {row.kind === 'item' ? row.primaryForm : ''}
                </Text>
                <Text className="text-caption text-secondary">
                  {row.kind === 'item' ? row.meaning : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

export default function BrowseCompareScreen() {
  const params = useLocalSearchParams<{
    left?: string | string[];
    right?: string | string[];
    leftType?: string | string[];
  }>();
  const left = paramString(params.left);
  const right = paramString(params.right);
  const leftTypeParam = paramString(params.leftType);
  const leftType = COMPARABLE_TYPES.find((type) => type === leftTypeParam);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Compare"
        backTestID="browse-compare-back"
        backAccessibilityLabel="Back to details"
      />
      {left && !right ? (
        <ComparePicker leftId={left} leftType={leftType} />
      ) : (
        <CompareView leftId={left} rightId={right} />
      )}
    </View>
  );
}
