import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  countBrowse,
  listBrowsePage,
  listPassageUnlockStates,
  type BrowseRowModel,
} from '@/data/curriculum/browseRepository';

import BrowseScreen from './index';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as Record<string, string | string[]>);

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    setParams: (...args: unknown[]) => mockSetParams(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot reference out-of-scope imports
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));

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

const KANJI_ROW: BrowseRowModel = {
  kind: 'item',
  id: '1',
  jlptLevel: 'N5',
  sortOrder: 1,
  itemType: 'kanji',
  primaryForm: '水',
  meaning: 'water',
  studyStatus: 'not_started',
  srsStage: null,
};

const LOCKED_PASSAGE_ROW: BrowseRowModel = {
  kind: 'passage',
  id: '9',
  jlptLevel: 'N5',
  sortOrder: 2,
  title: '市場で',
  summaryJa: null,
  summaryEn: 'A short trip to the market.',
  locked: true,
  itemsRemainingToUnlock: 3,
};

function renderBrowse() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <BrowseScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({});
  mockListPassageUnlockStates.mockReturnValue(new Map());
  mockListBrowsePage.mockReturnValue([KANJI_ROW, LOCKED_PASSAGE_ROW]);
  mockCountBrowse.mockReturnValue(2);
});

describe('BrowseScreen', () => {
  it('renders items and passages together in one flat list', async () => {
    renderBrowse();

    await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());
    expect(screen.getByTestId('browse-item-1')).toBeTruthy();
    expect(screen.getByTestId('browse-passage-9')).toBeTruthy();
  });

  it('shows a passage row with its English summary and a destination-framed lock chip', async () => {
    renderBrowse();

    await waitFor(() => expect(screen.getByTestId('browse-passage-9')).toBeTruthy());
    expect(screen.getByText('A short trip to the market.')).toBeTruthy();
    expect(screen.getByTestId('browse-passage-9-lock')).toHaveTextContent('3 to go');
  });

  it('never renders a dependency lock or "learn first" affordance on item rows (BUG7)', async () => {
    renderBrowse();

    await waitFor(() => expect(screen.getByTestId('browse-item-1')).toBeTruthy());

    const row = screen.getByTestId('browse-item-1');
    expect(screen.queryByText(/learn first/i)).toBeNull();
    expect(screen.queryByTestId('browse-item-1-dependencies')).toBeNull();
    // The old Learn level screen dimmed prerequisite-locked rows to 50% and made
    // them inert. Browse rows are always fully legible and always tappable.
    expect(row).toBeEnabled();
    expect(row.props.className ?? '').not.toContain('opacity-50');

    fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith('/browse/item/1');
  });

  it('opens item and passage details under the browse stack', async () => {
    renderBrowse();
    await waitFor(() => expect(screen.getByTestId('browse-item-1')).toBeTruthy());

    fireEvent.press(screen.getByTestId('browse-item-1'));
    expect(mockPush).toHaveBeenCalledWith('/browse/item/1');

    fireEvent.press(screen.getByTestId('browse-passage-9'));
    expect(mockPush).toHaveBeenCalledWith('/browse/passage/9');
  });

  it('exposes all five facets as pills', async () => {
    renderBrowse();
    await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

    for (const facet of ['levels', 'types', 'performance', 'srsStages', 'lock']) {
      expect(screen.getByTestId(`browse-filter-pill-${facet}`)).toBeTruthy();
    }
  });

  describe('filter drawer', () => {
    it('shows a live Apply count and applies the draft selection', async () => {
      renderBrowse();
      await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

      fireEvent.press(screen.getByTestId('browse-filter-pill-levels'));
      fireEvent.press(screen.getByTestId('browse-filter-option-levels-N5'));

      mockCountBrowse.mockReturnValue(12);
      await waitFor(() =>
        expect(screen.getByTestId('browse-filter-apply-levels')).toHaveTextContent('Apply (12)'),
      );

      fireEvent.press(screen.getByTestId('browse-filter-apply-levels'));

      await waitFor(() => {
        const queryInput = mockListBrowsePage.mock.calls.at(-1)?.[1];
        expect(queryInput?.filters.levels).toEqual(['N5']);
      });
    });

    it('disables Apply when the draft selection matches nothing', async () => {
      renderBrowse();
      await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

      fireEvent.press(screen.getByTestId('browse-filter-pill-levels'));
      mockCountBrowse.mockReturnValue(0);
      fireEvent.press(screen.getByTestId('browse-filter-option-levels-N1'));

      await waitFor(() =>
        expect(screen.getByTestId('browse-filter-apply-levels')).toHaveTextContent('Apply (0)'),
      );
      expect(screen.getByTestId('browse-filter-apply-levels')).toBeDisabled();
    });
  });

  it('summarizes an applied facet on its pill and can clear just that facet', async () => {
    renderBrowse();
    await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

    fireEvent.press(screen.getByTestId('browse-filter-pill-types'));
    fireEvent.press(screen.getByTestId('browse-filter-option-types-vocabulary'));
    fireEvent.press(screen.getByTestId('browse-filter-option-types-grammar'));
    mockCountBrowse.mockReturnValue(5);

    await waitFor(() =>
      expect(screen.getByTestId('browse-filter-apply-types')).toHaveTextContent('Apply (5)'),
    );
    fireEvent.press(screen.getByTestId('browse-filter-apply-types'));

    await waitFor(() =>
      expect(screen.getByTestId('browse-filter-pill-types')).toHaveTextContent(
        'Vocab + Grammar',
      ),
    );

    fireEvent.press(screen.getByTestId('browse-filter-pill-types-clear'));
    await waitFor(() =>
      expect(screen.getByTestId('browse-filter-pill-types')).toHaveTextContent('Type'),
    );
  });

  describe('empty state', () => {
    it('offers "No matches" with a clear-filters action once something is filtering', async () => {
      renderBrowse();
      await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

      mockListBrowsePage.mockReturnValue([]);
      mockCountBrowse.mockReturnValue(0);
      fireEvent.changeText(screen.getByTestId('browse-search'), 'zzzz');

      await waitFor(() => expect(screen.getByTestId('browse-empty')).toBeTruthy());
      expect(screen.getByText('No matches')).toBeTruthy();

      mockListBrowsePage.mockReturnValue([KANJI_ROW]);
      mockCountBrowse.mockReturnValue(1);
      fireEvent.press(screen.getByTestId('browse-empty-clear'));

      await waitFor(() => expect(screen.getByTestId('browse-search')).toHaveProp('value', ''));
    });
  });

  describe('search', () => {
    it('keeps the raw typed text in the field rather than converting it to kana', async () => {
      renderBrowse();
      await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

      fireEvent.changeText(screen.getByTestId('browse-search'), 'mizu');

      expect(screen.getByTestId('browse-search')).toHaveProp('value', 'mizu');
    });

    it('debounces before querying and fans out to kana branches', async () => {
      jest.useFakeTimers();
      try {
        renderBrowse();
        await act(async () => {
          jest.runOnlyPendingTimers();
        });
        mockListBrowsePage.mockClear();

        fireEvent.changeText(screen.getByTestId('browse-search'), 'mizu');
        expect(mockListBrowsePage).not.toHaveBeenCalled();

        await act(async () => {
          jest.advanceTimersByTime(200);
        });

        const queryInput = mockListBrowsePage.mock.calls.at(-1)?.[1];
        expect(queryInput?.search?.raw).toBe('mizu');
        expect(queryInput?.search?.kana).toContain('みず');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('seeds the level facet when arriving from a /learn/[level] redirect', async () => {
    mockUseLocalSearchParams.mockReturnValue({ level: 'N4' });
    renderBrowse();

    await waitFor(() => {
      const queryInput = mockListBrowsePage.mock.calls.at(-1)?.[1];
      expect(queryInput?.filters.levels).toEqual(['N4']);
    });
    expect(mockSetParams).toHaveBeenCalledWith({ level: undefined, type: undefined });
  });

  it('seeds type alongside level from the learn redirect query string', async () => {
    mockUseLocalSearchParams.mockReturnValue({ level: 'N5', type: 'vocabulary' });
    renderBrowse();

    await waitFor(() => {
      const queryInput = mockListBrowsePage.mock.calls.at(-1)?.[1];
      expect(queryInput?.filters.levels).toEqual(['N5']);
      expect(queryInput?.filters.types).toEqual(['vocabulary']);
    });
  });

  it('normalizes a repeated level param array before seeding', async () => {
    mockUseLocalSearchParams.mockReturnValue({ level: ['N3', 'N2'] });
    renderBrowse();

    await waitFor(() => {
      const queryInput = mockListBrowsePage.mock.calls.at(-1)?.[1];
      expect(queryInput?.filters.levels).toEqual(['N3']);
    });
  });

  it('offers Clear all on the filter bar when facets or search are active', async () => {
    renderBrowse();
    await waitFor(() => expect(screen.getByTestId('browse-list')).toBeTruthy());

    fireEvent.press(screen.getByTestId('browse-filter-pill-levels'));
    fireEvent.press(screen.getByTestId('browse-filter-option-levels-N5'));
    mockCountBrowse.mockReturnValue(12);
    await waitFor(() =>
      expect(screen.getByTestId('browse-filter-apply-levels')).toHaveTextContent('Apply (12)'),
    );
    fireEvent.press(screen.getByTestId('browse-filter-apply-levels'));

    await waitFor(() => expect(screen.getByTestId('browse-clear-all')).toBeTruthy());
    fireEvent.press(screen.getByTestId('browse-clear-all'));

    await waitFor(() =>
      expect(screen.getByTestId('browse-filter-pill-levels')).toHaveTextContent('Level'),
    );
    expect(mockSetParams).toHaveBeenCalledWith({ level: undefined, type: undefined });
  });

  it('shows a distinct error state when the browse query fails', async () => {
    mockListBrowsePage.mockImplementation(() => {
      throw new Error('boom');
    });
    renderBrowse();

    await waitFor(() => expect(screen.getByTestId('browse-error')).toBeTruthy());
    expect(screen.getByTestId('browse-error-retry')).toBeTruthy();
    expect(screen.queryByTestId('browse-empty')).toBeNull();
  });
});
