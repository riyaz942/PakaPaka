import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BROWSE_COUNT_DEBOUNCE_MS, BROWSE_PAGE_SIZE, BROWSE_SEARCH_DEBOUNCE_MS } from '@/config/constants';
import {
  EMPTY_BROWSE_FILTERS,
  clearFacet,
  type BrowseFacetKey,
  type BrowseFilters,
} from '@/core/browse/browseFilters';
import { buildSearchBranches } from '@/core/browse/browseSearch';
import type { PassageUnlockStatus } from '@/core/content/passageUnlock';
import {
  countBrowse,
  listBrowsePage,
  listPassageUnlockStates,
  type BrowseQueryInput,
  type BrowseRowModel,
} from '@/data/curriculum/browseRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export type UseBrowseItemsResult = {
  rows: BrowseRowModel[];
  totalCount: number;
  /** True while the first page of a new filter/search combination is loading. */
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Raw text as typed — never rewritten to kana (FR65). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  /** Currently applied filters (drafts live in the drawer until Apply). */
  filters: BrowseFilters;
  applyFilters: (filters: BrowseFilters) => void;
  clearFilters: () => void;
  clearFacetFilter: (facet: BrowseFacetKey) => void;
  loadMore: () => void;
  /** Recomputes derived passage unlock state (e.g. after a review session). */
  refresh: () => void;
  /** Derived passage unlock state, shared with the drawer's live count. */
  passageUnlock: ReadonlyMap<string, PassageUnlockStatus>;
};

/**
 * Browse list state (FR62–FR67): debounced search, applied facets, page
 * accumulation and the derived passage unlock map the Lock facet and row chips
 * both read.
 *
 * SQLite reads here are synchronous, so there is no streaming or progressive
 * merge — one debounced query produces one ordered page.
 */
export function useBrowseItems(): UseBrowseItemsResult {
  const { curriculumDb, userDb } = useDatabase();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);
  const [rows, setRows] = useState<BrowseRowModel[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  // Guards loadMore against firing twice for the same offset while FlatList's
  // onEndReached bounces during a fast scroll.
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, BROWSE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const passageUnlock = useMemo(
    () => {
      try {
        return listPassageUnlockStates(curriculumDb, userDb);
      } catch {
        return new Map();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken is an explicit recompute trigger
    [curriculumDb, userDb, refreshToken],
  );

  const queryInput: BrowseQueryInput = useMemo(
    () => ({
      filters,
      search: buildSearchBranches(debouncedSearch),
      passageUnlock,
    }),
    [filters, debouncedSearch, passageUnlock],
  );

  // First page: re-runs whenever the applied filters or debounced search change.
  useEffect(() => {
    setLoading(true);
    try {
      setRows(listBrowsePage(userDb, queryInput, { limit: BROWSE_PAGE_SIZE, offset: 0 }));
      setTotalCount(countBrowse(userDb, queryInput));
    } catch {
      // A failed read shows the empty state rather than tearing down the tab.
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [userDb, queryInput]);

  const hasMore = rows.length < totalCount;

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current) return;
    if (rows.length >= totalCount) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = listBrowsePage(userDb, queryInput, {
        limit: BROWSE_PAGE_SIZE,
        offset: rows.length,
      });
      setRows((current) => [...current, ...nextPage]);
    } catch {
      // Keep what is already on screen; the next end-reached can retry.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [userDb, queryInput, rows.length, totalCount]);

  const applyFilters = useCallback((next: BrowseFilters) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_BROWSE_FILTERS);
    setSearchInput('');
  }, []);

  const clearFacetFilter = useCallback((facet: BrowseFacetKey) => {
    setFilters((current) => clearFacet(current, facet));
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  return {
    rows,
    totalCount,
    loading,
    loadingMore,
    hasMore,
    searchInput,
    setSearchInput,
    filters,
    applyFilters,
    clearFilters,
    clearFacetFilter,
    loadMore,
    refresh,
    passageUnlock,
  };
}

/**
 * Live "Apply (N)" count for the filter drawer (FR64). Draft filters are counted
 * on their own short debounce so rapid chip toggling does not fire a query per
 * tap, while the number still feels immediate.
 */
export function useBrowseDraftCount(
  draft: BrowseFilters,
  search: string,
  passageUnlock: ReadonlyMap<string, PassageUnlockStatus>,
): { count: number; isCounting: boolean } {
  const { userDb } = useDatabase();
  const [count, setCount] = useState(0);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    setIsCounting(true);
    const timer = setTimeout(() => {
      try {
        setCount(
          countBrowse(userDb, {
            filters: draft,
            search: buildSearchBranches(search),
            passageUnlock,
          }),
        );
      } catch {
        setCount(0);
      } finally {
        setIsCounting(false);
      }
    }, BROWSE_COUNT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [userDb, draft, search, passageUnlock]);

  return { count, isCounting };
}
