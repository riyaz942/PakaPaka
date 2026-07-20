import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { CompareView } from '@/components/common/CompareView';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useBrowseItems } from '@/data/hooks/useBrowseItems';

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

/** Minimal second-item picker — reuses Browse's search, not its filter drawer. */
function ComparePicker({ leftId }: { leftId: string }) {
  const { rows, loading, searchInput, setSearchInput } = useBrowseItems();
  const candidates = rows
    .filter((row) => row.kind === 'item' && row.id !== leftId)
    .slice(0, 30);

  return (
    <View className="flex-1 px-space-lg pt-space-md">
      <Text className="text-body text-secondary">Choose a second item to compare against.</Text>

      <TextInput
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search items"
        accessibilityLabel="Search items to compare"
        testID="compare-picker-search"
        className="mt-space-md min-h-[44px] rounded-radius-md border border-border bg-surface px-3 text-body text-primary"
      />

      <ScrollView
        className="mt-space-md flex-1"
        contentContainerClassName="pb-space-2xl"
        keyboardShouldPersistTaps="handled"
        testID="compare-picker-list">
        {loading ? (
          <Text className="mt-space-md text-body text-secondary">Loading…</Text>
        ) : candidates.length === 0 ? (
          <Text className="mt-space-md text-body text-secondary">No matching items.</Text>
        ) : (
          candidates.map((row) => (
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
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default function BrowseCompareScreen() {
  const params = useLocalSearchParams<{ left?: string | string[]; right?: string | string[] }>();
  const left = paramString(params.left);
  const right = paramString(params.right);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Compare"
        backTestID="browse-compare-back"
        backAccessibilityLabel="Back to details"
      />
      {left && !right ? (
        <ComparePicker leftId={left} />
      ) : (
        <CompareView leftId={left} rightId={right} />
      )}
    </View>
  );
}
