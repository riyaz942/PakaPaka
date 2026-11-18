import { useFocusEffect, useLocalSearchParams, router, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrowseList } from '@/components/browse/BrowseList';
import { FilterDrawer } from '@/components/browse/FilterDrawer';
import { FilterPill } from '@/components/browse/FilterPill';
import { SearchField } from '@/components/browse/SearchField';
import { GuidanceCardNotice } from '@/components/common/GuidanceCardNotice';
import { ScreenTitle } from '@/components/common/ScreenTitle';
import { GUIDANCE_CARD_BY_ID } from '@/components/onboarding/cardRegistry';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  BROWSE_FACET_KEYS,
  EMPTY_BROWSE_FILTERS,
  isBrowseFiltersEmpty,
  isBrowseTypeValue,
  summarizeFacet,
  toggleFacetValue,
  type BrowseFacetKey,
  type BrowseFilters,
  type BrowseTypeValue,
} from '@/core/browse/browseFilters';
import { isJlptLevel, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useBrowseDraftCount, useBrowseItems } from '@/data/hooks/useBrowseItems';
import { useGuidanceCard } from '@/data/hooks/useGuidanceCard';
import { useWideLayout } from '@/hooks/useWideLayout';
import { useSync } from '@/providers/SyncProvider';
import { cn } from '@/utils/cn';

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Normalize Expo search params that may arrive as `string | string[]`. */
function seededLevelFromParams(level: string | string[] | undefined): JLPTLevel | null {
  const value = firstParam(level);
  return value && isJlptLevel(value) ? value : null;
}

function seededTypeFromParams(type: string | string[] | undefined): BrowseTypeValue | null {
  const value = firstParam(type);
  return value && isBrowseTypeValue(value) ? value : null;
}

/** Desktop web: width of the search-and-filter panel beside the results. */
const BROWSE_PANEL_WIDTH = 320;

/**
 * Unified Browse (FR62–FR67): one discovery surface for radicals, kanji,
 * vocabulary, grammar and reading passages, replacing the per-level Learn
 * screens and the separate Read tab.
 */
export default function BrowseScreen() {
  // Desktop web: search and filters move to a panel beside the results.
  const wide = useWideLayout();
  const params = useLocalSearchParams<{ level?: string | string[]; type?: string | string[] }>();
  const {
    rows,
    totalCount,
    loading,
    loadingMore,
    error,
    searchInput,
    setSearchInput,
    filters,
    applyFilters,
    clearFilters,
    clearFacetFilter,
    loadMore,
    refresh,
    reload,
    passageUnlock,
    newlyUnlockedPassageIds,
  } = useBrowseItems();
  const { appliedVersion } = useSync();

  const [openFacet, setOpenFacet] = useState<BrowseFacetKey | null>(null);
  const [draft, setDraft] = useState<BrowseFilters>(filters);
  // Typed-but-not-yet-submitted search text (FR65). Kept separate from the
  // hook's `searchInput` so typing never fires a query — only the search
  // button or the keyboard's submit key commits it.
  const [searchDraft, setSearchDraft] = useState('');
  // The SQLite read behind `loading` is synchronous, so `loading` itself
  // never has a chance to paint true — it flips true then false within the
  // same effect tick. `isBusy` is set synchronously on a search or filter
  // change (so it does paint) and the change itself is deferred by a tick,
  // giving the loader a real frame on screen. While busy, the search field,
  // filter pills and Clear all are disabled.
  const [isBusy, setIsBusy] = useState(false);
  // Bumped in the same render as the deferred change. The list query runs in
  // that render's effects, so the effect below clears `isBusy` once it is done.
  const [commitTick, setCommitTick] = useState(0);

  // A filter that excludes passages simply makes this false — "renders a locked
  // passage" means one is in the current result set, not in the catalogue.
  const passageLocksCard = useGuidanceCard(
    'passage-locks',
    rows.some((row) => row.kind === 'passage' && row.locked),
  );

  // Passage unlock is derived from SRS state, so returning from a review or
  // lesson can change which passages are locked. Stable unlock Map identity
  // (when content is unchanged) keeps this from wiping the list.
  useFocusEffect(
    useCallback(() => {
      refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedVersion is an explicit reload trigger
    }, [refresh, appliedVersion]),
  );

  // `/learn/[level]` redirects arrive with level/type in the query string.
  // Seed those as facets, then strip the params so remount/clear cannot
  // re-apply a stale seed.
  const seededLevel = seededLevelFromParams(params.level);
  const seededType = seededTypeFromParams(params.type);
  const lastSeedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!seededLevel && !seededType) return;

    const seedKey = `${seededLevel ?? ''}|${seededType ?? ''}`;
    if (lastSeedKeyRef.current === seedKey) return;
    lastSeedKeyRef.current = seedKey;

    applyFilters({
      ...EMPTY_BROWSE_FILTERS,
      ...(seededLevel ? { levels: [seededLevel] } : {}),
      ...(seededType ? { types: [seededType] } : {}),
    });

    router.setParams({ level: undefined, type: undefined });
  }, [seededLevel, seededType, applyFilters]);

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

  /** Shows the loader, then applies `change` a tick later (see `isBusy`). */
  const runBusy = useCallback((change: () => void) => {
    setIsBusy(true);
    setTimeout(() => {
      change();
      setCommitTick((tick) => tick + 1);
    }, 0);
  }, []);

  // `loading` flips true→false within one synchronous SQLite read, so it never
  // commits as true and can't drive the clear. `commitTick` changes in the
  // same render as the deferred change, and the hook's (synchronous) list
  // query runs in that render's effects before this one.
  useEffect(() => {
    if (commitTick > 0) setIsBusy(false);
  }, [commitTick]);

  const runSearch = useCallback(() => {
    // Nothing to do — this term is already applied.
    if (searchDraft === searchInput) return;
    runBusy(() => setSearchInput(searchDraft));
  }, [runBusy, setSearchInput, searchDraft, searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchDraft('');
    if (searchInput.length > 0) runBusy(() => setSearchInput(''));
  }, [runBusy, setSearchInput, searchInput]);

  const handleToggle = useCallback(
    (value: string) => {
      if (!openFacet) return;
      setDraft((current) => toggleFacetValue(current, openFacet, value));
    },
    [openFacet],
  );

  const handleApply = useCallback(() => {
    runBusy(() => applyFilters(draft));
    setOpenFacet(null);
  }, [runBusy, applyFilters, draft]);

  const handleClearFacet = useCallback(() => {
    if (!openFacet) return;
    setDraft((current) => ({ ...current, [openFacet]: [] }));
  }, [openFacet]);

  const handleClearAll = useCallback(() => {
    runBusy(clearFilters);
    setSearchDraft('');
    lastSeedKeyRef.current = null;
    router.setParams({ level: undefined, type: undefined });
  }, [runBusy, clearFilters]);

  const hasActiveFilters = !isBrowseFiltersEmpty(filters) || searchInput.length > 0;

  const filterPills = BROWSE_FACET_KEYS.map((facet) => {
    const active = filters[facet].length > 0;
    return (
      <FilterPill
        key={facet}
        label={summarizeFacet(facet, filters[facet])}
        active={active}
        onPress={() => openDrawer(facet)}
        onClear={active ? () => runBusy(() => clearFacetFilter(facet)) : undefined}
        disabled={isBusy}
        testID={`browse-filter-pill-${facet}`}
      />
    );
  });

  const clearAll = hasActiveFilters ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Clear all filters and search"
      accessibilityState={{ disabled: isBusy }}
      disabled={isBusy}
      onPress={handleClearAll}
      testID="browse-clear-all"
      className="min-h-[44px] justify-center px-space-sm">
      <Text className="text-body-sm font-ui-bold text-brand-text">Clear all</Text>
    </Pressable>
  ) : null;

  const controls = (
    <>
      <View className="mt-space-md">
        <SearchField
          value={searchDraft}
          onChangeText={setSearchDraft}
          onSubmit={runSearch}
          onClear={handleClearSearch}
            disabled={isBusy}
          testID="browse-search"
        />
      </View>

      {wide ? (
        <View className="mt-space-md flex-row flex-wrap items-center gap-space-sm">
          {filterPills}
          {clearAll}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-space-md max-h-[56px] flex-grow-0"
          contentContainerClassName="items-center gap-space-sm pr-space-lg">
          {filterPills}
          {clearAll}
        </ScrollView>
      )}

        {!loading && !isBusy && !error ? (
        <Text
          className="mb-space-sm mt-space-sm text-caption font-ui-semibold text-muted"
          testID="browse-result-count">
          {totalCount === 1 ? '1 result' : `${totalCount} results`}
        </Text>
      ) : null}

      {/* Outside the list, never a row: the notice explains the lock chip,
          it is not one of the results. */}
      {passageLocksCard.visible ? (
        <GuidanceCardNotice
          card={GUIDANCE_CARD_BY_ID['passage-locks']}
          onDismiss={passageLocksCard.dismiss}
        />
      ) : null}
    </>
  );

  const list = (
    <View className="flex-1 pb-space-sm">
      <BrowseList
        rows={rows}
            loading={loading || isBusy}
        loadingMore={loadingMore}
        error={error}
        onEndReached={loadMore}
        onSelectItem={(id) => router.push(`/browse/item/${id}` as Href)}
        onSelectPassage={(id) => router.push(`/browse/passage/${id}` as Href)}
        onClearFilters={handleClearAll}
        canClearFilters={hasActiveFilters}
        onRetry={reload}
            newlyUnlockedPassageIds={newlyUnlockedPassageIds}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className={cn('flex-1', wide ? 'px-space-xl' : 'px-space-lg pt-space-md')}
        style={{
          alignSelf: 'center',
          maxWidth: wide ? undefined : MaxContentWidth,
          width: '100%',
          // Inline: on web SafeAreaView's own inset padding overrides a pt-* class.
          paddingTop: wide ? Spacing.four : undefined,
        }}>
        <ScreenTitle>Browse</ScreenTitle>

        {wide ? (
          <View className="flex-1 flex-row gap-space-xl">
            <ScrollView className="flex-grow-0" style={{ width: BROWSE_PANEL_WIDTH }}>
              {controls}
            </ScrollView>
            <View className="mt-space-md flex-1">{list}</View>
          </View>
        ) : (
          <>
            {controls}
            {list}
          </>
        )}
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
