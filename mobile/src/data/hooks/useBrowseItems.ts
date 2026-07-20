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
  /** Set when the list query fails — distinct from a genuine empty curriculum. */
  error: string | null;
  /** Set when passage unlock could not be derived; passage lock chips fail closed. */
  unlockError: boolean;
  /** Raw text as typed — never rewritten to kana (FR65). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  /** Debounced search used by the list and the Apply count (kept in sync). */
  debouncedSearch: string;
  /** Currently applied filters (drafts live in the drawer until Apply). */
  filters: BrowseFilters;
  applyFilters: (filters: BrowseFilters) => void;
  clearFilters: () => void;
  clearFacetFilter: (facet: BrowseFacetKey) => void;
  loadMore: () => void;
  /** Recomputes derived passage unlock state (e.g. after a review session). */
  refresh: () => void;
  /** Re-runs unlock + the current list query (error recovery). */
  reload: () => void;
  /** Derived passage unlock state, shared with the drawer's live count. */
  passageUnlock: ReadonlyMap<string, PassageUnlockStatus>;
};

function passageUnlockMapsEqual(
  left: ReadonlyMap<string, PassageUnlockStatus>,
  right: ReadonlyMap<string, PassageUnlockStatus>,
): boolean {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const [id, status] of left) {
    const other = right.get(id);
    if (
      !other ||
      other.unlocked !== status.unlocked ||
      other.itemsRemainingToUnlock !== status.itemsRemainingToUnlock
    ) {
      return false;
    }
  }
  return true;
}

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
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [listEpoch, setListEpoch] = useState(0);

  // Guards loadMore against firing twice for the same offset while FlatList's
  // onEndReached bounces during a fast scroll.
  const loadingMoreRef = useRef(false);
  // Bumped whenever the applied query identity changes so a late loadMore
  // cannot append pages from a superseded filter/search combination.
  const queryGenerationRef = useRef(0);
  // Keeps Map identity stable across focus refreshes when unlock content is
  // unchanged, so the list query does not reset scroll/pages.
  const passageUnlockCacheRef = useRef<Map<string, PassageUnlockStatus>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, BROWSE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { passageUnlock, unlockError } = useMemo(() => {
    try {
      const next = listPassageUnlockStates(curriculumDb, userDb);
      if (passageUnlockMapsEqual(passageUnlockCacheRef.current, next)) {
        return { passageUnlock: passageUnlockCacheRef.current, unlockError: false };
      }
      passageUnlockCacheRef.current = next;
      return { passageUnlock: next, unlockError: false };
    } catch {
      // Fail closed: empty map + flag so rows do not render as unlocked and the
      // Lock facet does not invent matches.
      const empty = new Map<string, PassageUnlockStatus>();
      passageUnlockCacheRef.current = empty;
      return { passageUnlock: empty, unlockError: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken is an explicit recompute trigger
  }, [curriculumDb, userDb, refreshToken]);

  const queryInput: BrowseQueryInput = useMemo(
    () => ({
      filters,
      search: buildSearchBranches(debouncedSearch),
      passageUnlock,
    }),
    [filters, debouncedSearch, passageUnlock],
  );

  // First page: re-runs whenever the applied filters, debounced search, or
  // unlock-dependent Lock facet scope changes. Stable unlock Map identity (when
  // content is unchanged) avoids wiping scroll position on every tab focus.
  useEffect(() => {
    const generation = ++queryGenerationRef.current;
    loadingMoreRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const nextRows = listBrowsePage(userDb, queryInput, {
        limit: BROWSE_PAGE_SIZE,
        offset: 0,
      });
      const nextCount = countBrowse(userDb, queryInput);
      if (generation !== queryGenerationRef.current) return;
      setRows(nextRows);
      setTotalCount(nextCount);
    } catch {
      if (generation !== queryGenerationRef.current) return;
      setRows([]);
      setTotalCount(0);
      setError("Couldn't load browse results. Try again.");
    } finally {
      if (generation === queryGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [userDb, queryInput, listEpoch]);

  const hasMore = rows.length < totalCount;

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current) return;
    if (rows.length >= totalCount) return;

    const generation = queryGenerationRef.current;
    const offset = rows.length;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = listBrowsePage(userDb, queryInput, {
        limit: BROWSE_PAGE_SIZE,
        offset,
      });
      if (generation !== queryGenerationRef.current) return;
      setRows((current) => {
        // Drop the append if a reset already replaced the list under us.
        if (current.length !== offset) return current;
        return [...current, ...nextPage];
      });
    } catch {
      // Keep what is already on screen; the next end-reached can retry.
    } finally {
      if (generation === queryGenerationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [userDb, queryInput, rows.length, totalCount]);

  const applyFilters = useCallback((next: BrowseFilters) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_BROWSE_FILTERS);
    setSearchInput('');
    // Flush immediately so Apply count and the list do not keep the old term
    // for up to BROWSE_SEARCH_DEBOUNCE_MS after the user cleared.
    setDebouncedSearch('');
  }, []);

  const clearFacetFilter = useCallback((facet: BrowseFacetKey) => {
    setFilters((current) => clearFacet(current, facet));
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  const reload = useCallback(() => {
    setRefreshToken((token) => token + 1);
    setListEpoch((epoch) => epoch + 1);
  }, []);

  return {
    rows,
    totalCount,
    loading,
    loadingMore,
    hasMore,
    error,
    unlockError,
    searchInput,
    setSearchInput,
    debouncedSearch,
    filters,
    applyFilters,
    clearFilters,
    clearFacetFilter,
    loadMore,
    refresh,
    reload,
    passageUnlock,
  };
}

/**
 * Live "Apply (N)" count for the filter drawer (FR64). Draft filters are counted
 * on their own short debounce so rapid chip toggling does not fire a query per
 * tap, while the number still feels immediate.
 *
 * Pass the same debounced search the list uses so Apply (N) cannot disagree
 * with the visible rows around the search debounce window.
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
