import { act, renderHook, waitFor } from '@testing-library/react-native';

import { BROWSE_PAGE_SIZE } from '@/config/constants';
import { EMPTY_BROWSE_FILTERS } from '@/core/browse/browseFilters';
import {
  countBrowse,
  listBrowsePage,
  listPassageUnlockStates,
  type BrowseQueryInput,
  type BrowseRowModel,
} from '@/data/curriculum/browseRepository';
import { useBrowseItems } from '@/data/hooks/useBrowseItems';

// DatabaseProvider hands out one stable context value for the app's lifetime,
// so the mock must return a stable object too — a fresh literal per render
// would invalidate every downstream memo and spin the hook forever.
jest.mock('@/data/hooks/useDatabase', () => {
  const handles = { curriculumDb: {}, userDb: {}, isReady: true, error: null };
  return { useDatabase: () => handles };
});

jest.mock('@/data/curriculum/browseRepository', () => ({
  listBrowsePage: jest.fn(),
  countBrowse: jest.fn(),
  listPassageUnlockStates: jest.fn(),
}));

const mockListBrowsePage = listBrowsePage as jest.MockedFunction<typeof listBrowsePage>;
const mockCountBrowse = countBrowse as jest.MockedFunction<typeof countBrowse>;
const mockListPassageUnlockStates = listPassageUnlockStates as jest.MockedFunction<
  typeof listPassageUnlockStates
>;

function itemRow(id: number): BrowseRowModel {
  return {
    kind: 'item',
    id: String(id),
    jlptLevel: 'N5',
    sortOrder: id,
    itemType: 'kanji',
    primaryForm: '水',
    meaning: 'water',
    reading: 'みず',
    studyStatus: 'not_started',
    srsStage: null,
  };
}

function page(size: number, startAt = 0): BrowseRowModel[] {
  return Array.from({ length: size }, (_, index) => itemRow(startAt + index));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListPassageUnlockStates.mockReturnValue(new Map());
  mockListBrowsePage.mockReturnValue(page(3));
  mockCountBrowse.mockReturnValue(3);
});

describe('useBrowseItems', () => {
  it('loads the first page and total count on mount', async () => {
    const { result } = renderHook(() => useBrowseItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toHaveLength(3);
    expect(result.current.totalCount).toBe(3);
    expect(mockListBrowsePage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { limit: BROWSE_PAGE_SIZE, offset: 0 },
    );
  });

  describe('search', () => {
    it('does not query until the debounce elapses', async () => {
      jest.useFakeTimers();
      try {
        const { result } = renderHook(() => useBrowseItems());
        await act(async () => {
          jest.runOnlyPendingTimers();
        });
        mockListBrowsePage.mockClear();

        act(() => {
          result.current.setSearchInput('mizu');
        });
        expect(mockListBrowsePage).not.toHaveBeenCalled();

        await act(async () => {
          jest.advanceTimersByTime(200);
        });
        expect(mockListBrowsePage).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps the typed text exactly as entered — never rewritten to kana', async () => {
      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setSearchInput('mizu');
      });

      expect(result.current.searchInput).toBe('mizu');
    });

    it('passes the fanned-out branches to the query', async () => {
      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setSearchInput('mizu');
      });

      await waitFor(() => {
        const lastCall = mockListBrowsePage.mock.calls.at(-1);
        const queryInput = lastCall?.[1] as BrowseQueryInput;
        expect(queryInput.search?.raw).toBe('mizu');
        expect(queryInput.search?.kana).toContain('みず');
      });
    });

    it('resets pagination when the search changes', async () => {
      mockListBrowsePage.mockReturnValue(page(BROWSE_PAGE_SIZE));
      mockCountBrowse.mockReturnValue(BROWSE_PAGE_SIZE * 2);

      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.loadMore();
      });
      await waitFor(() => expect(result.current.rows).toHaveLength(BROWSE_PAGE_SIZE * 2));

      mockListBrowsePage.mockReturnValue(page(2));
      act(() => {
        result.current.setSearchInput('mizu');
      });

      await waitFor(() => expect(result.current.rows).toHaveLength(2));
    });
  });

  describe('pagination', () => {
    it('appends the next page and stops when the total is reached', async () => {
      mockListBrowsePage.mockReturnValueOnce(page(BROWSE_PAGE_SIZE));
      mockCountBrowse.mockReturnValue(BROWSE_PAGE_SIZE + 5);

      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasMore).toBe(true);

      mockListBrowsePage.mockReturnValueOnce(page(5, BROWSE_PAGE_SIZE));
      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => expect(result.current.rows).toHaveLength(BROWSE_PAGE_SIZE + 5));
      expect(result.current.hasMore).toBe(false);
      expect(mockListBrowsePage).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.anything(),
        { limit: BROWSE_PAGE_SIZE, offset: BROWSE_PAGE_SIZE },
      );
    });

    it('ignores loadMore when everything is already loaded', async () => {
      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));
      mockListBrowsePage.mockClear();

      act(() => {
        result.current.loadMore();
      });

      expect(mockListBrowsePage).not.toHaveBeenCalled();
    });
  });

  describe('filters', () => {
    it('applies filters immediately and resets to the first page', async () => {
      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.applyFilters({ ...EMPTY_BROWSE_FILTERS, levels: ['N5'] });
      });

      await waitFor(() => {
        const lastCall = mockListBrowsePage.mock.calls.at(-1);
        const queryInput = lastCall?.[1] as BrowseQueryInput;
        expect(queryInput.filters.levels).toEqual(['N5']);
        expect(lastCall?.[2]).toEqual({ limit: BROWSE_PAGE_SIZE, offset: 0 });
      });
    });

    it('clearFilters drops every facet and the search text', async () => {
      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.applyFilters({ ...EMPTY_BROWSE_FILTERS, levels: ['N5'] });
        result.current.setSearchInput('mizu');
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual(EMPTY_BROWSE_FILTERS);
      expect(result.current.searchInput).toBe('');
    });

    it('clearFacet drops only the named facet', async () => {
      const { result } = renderHook(() => useBrowseItems());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.applyFilters({
          ...EMPTY_BROWSE_FILTERS,
          levels: ['N5'],
          types: ['kanji'],
        });
      });

      act(() => {
        result.current.clearFacetFilter('levels');
      });

      expect(result.current.filters.levels).toEqual([]);
      expect(result.current.filters.types).toEqual(['kanji']);
    });
  });

  it('surfaces an error instead of a silent empty curriculum when a query fails', async () => {
    mockListBrowsePage.mockImplementation(() => {
      throw new Error('malformed query');
    });

    const { result } = renderHook(() => useBrowseItems());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toMatch(/couldn't load/i);
  });

  it('flushes the debounced search immediately when filters are cleared', async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useBrowseItems());
      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      act(() => {
        result.current.setSearchInput('mizu');
      });
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      expect(result.current.debouncedSearch).toBe('mizu');

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.searchInput).toBe('');
      expect(result.current.debouncedSearch).toBe('');
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a loadMore append after the query identity has changed', async () => {
    mockListBrowsePage.mockReturnValue(page(BROWSE_PAGE_SIZE));
    mockCountBrowse.mockReturnValue(BROWSE_PAGE_SIZE * 2);

    const { result } = renderHook(() => useBrowseItems());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(BROWSE_PAGE_SIZE);

    // Simulate a stale end-reached: change filters (resets to page 0 with 2 rows)
    // then attempt loadMore against the old offset semantics.
    mockListBrowsePage.mockReturnValue(page(2));
    mockCountBrowse.mockReturnValue(2);
    act(() => {
      result.current.applyFilters({ ...EMPTY_BROWSE_FILTERS, levels: ['N5'] });
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    const callsBefore = mockListBrowsePage.mock.calls.length;
    act(() => {
      result.current.loadMore();
    });

    // totalCount is 2 and rows.length is 2 — loadMore should no-op.
    expect(mockListBrowsePage.mock.calls.length).toBe(callsBefore);
    expect(result.current.rows).toHaveLength(2);
  });
});
