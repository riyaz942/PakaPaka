import { useFocusEffect, useLocalSearchParams, router, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrowseList } from '@/components/browse/BrowseList';
import { FilterDrawer } from '@/components/browse/FilterDrawer';
import { FilterPill } from '@/components/browse/FilterPill';
import { SearchField } from '@/components/browse/SearchField';
import { MaxContentWidth } from '@/constants/theme';
import {
  BROWSE_FACET_KEYS,
  EMPTY_BROWSE_FILTERS,
  isBrowseFiltersEmpty,
  summarizeFacet,
  toggleFacetValue,
  type BrowseFacetKey,
  type BrowseFilters,
} from '@/core/browse/browseFilters';
import { isJlptLevel } from '@/data/curriculum/curriculum.types';
import { useBrowseDraftCount, useBrowseItems } from '@/data/hooks/useBrowseItems';

/**
 * Unified Browse (FR62–FR67): one discovery surface for radicals, kanji,
 * vocabulary, grammar and reading passages, replacing the per-level Learn
 * screens and the separate Read tab.
 */
export default function BrowseScreen() {
  const params = useLocalSearchParams<{ level?: string; type?: string }>();
  const {
    rows,
    totalCount,
    loading,
    loadingMore,
    searchInput,
    setSearchInput,
    filters,
    applyFilters,
    clearFilters,
    clearFacetFilter,
    loadMore,
    refresh,
    passageUnlock,
  } = useBrowseItems();

  const [openFacet, setOpenFacet] = useState<BrowseFacetKey | null>(null);
  const [draft, setDraft] = useState<BrowseFilters>(filters);

  // Passage unlock is derived from SRS state, so returning from a review or
  // lesson can change which passages are locked.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // `/learn/[level]` redirects arrive with a level in the query string. Level is
  // a facet now, so seed it as a filter — once, so the learner can clear it.
  const seededLevel = params.level && isJlptLevel(params.level) ? params.level : null;
  const seedAppliedRef = useRef(false);

  useEffect(() => {
    if (!seededLevel || seedAppliedRef.current) return;
    seedAppliedRef.current = true;
    applyFilters({ ...EMPTY_BROWSE_FILTERS, levels: [seededLevel] });
  }, [seededLevel, applyFilters]);

  const openDrawer = useCallback(
    (facet: BrowseFacetKey) => {
      setDraft(filters);
      setOpenFacet(facet);
    },
    [filters],
  );

  const { count: draftCount, isCounting } = useBrowseDraftCount(
    draft,
    searchInput,
    passageUnlock,
  );

  const handleToggle = useCallback(
    (value: string) => {
      if (!openFacet) return;
      setDraft((current) => toggleFacetValue(current, openFacet, value));
    },
    [openFacet],
  );

  const handleApply = useCallback(() => {
    applyFilters(draft);
    setOpenFacet(null);
  }, [applyFilters, draft]);

  const handleClearFacet = useCallback(() => {
    if (!openFacet) return;
    setDraft((current) => ({ ...current, [openFacet]: [] }));
  }, [openFacet]);

  const hasActiveFilters = !isBrowseFiltersEmpty(filters) || searchInput.length > 0;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        <Text className="text-title text-primary">Browse</Text>

        <View className="mt-space-md">
          <SearchField
            value={searchInput}
            onChangeText={setSearchInput}
            testID="browse-search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-space-md max-h-[56px] flex-grow-0"
          contentContainerClassName="gap-space-sm pr-space-lg">
          {BROWSE_FACET_KEYS.map((facet) => {
            const active = filters[facet].length > 0;
            return (
              <FilterPill
                key={facet}
                label={summarizeFacet(facet, filters[facet])}
                active={active}
                onPress={() => openDrawer(facet)}
                onClear={active ? () => clearFacetFilter(facet) : undefined}
                testID={`browse-filter-pill-${facet}`}
              />
            );
          })}
        </ScrollView>

        {!loading ? (
          <Text className="mt-space-sm text-body-sm text-secondary" testID="browse-result-count">
            {totalCount === 1 ? '1 result' : `${totalCount} results`}
          </Text>
        ) : null}

        <View className="mt-space-sm flex-1">
          <BrowseList
            rows={rows}
            loading={loading}
            loadingMore={loadingMore}
            onEndReached={loadMore}
            onSelectItem={(id) => router.push(`/browse/item/${id}` as Href)}
            onSelectPassage={(id) => router.push(`/browse/passage/${id}` as Href)}
            onClearFilters={clearFilters}
            canClearFilters={hasActiveFilters}
          />
        </View>
      </SafeAreaView>

      {openFacet ? (
        <FilterDrawer
          facet={openFacet}
          visible
          selected={draft[openFacet]}
          onToggle={handleToggle}
          onApply={handleApply}
          onClear={handleClearFacet}
          onDismiss={() => setOpenFacet(null)}
          count={draftCount}
          isCounting={isCounting}
        />
      ) : null}
    </View>
  );
}
