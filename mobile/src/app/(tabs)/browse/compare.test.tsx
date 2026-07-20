import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BrowseCompareScreen from './compare';

const mockBack = jest.fn();
const mockSetParams = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockCompareView = jest.fn();
const mockSetSearchInput = jest.fn();
let mockRows: { kind: 'item'; id: string; primaryForm: string; meaning: string }[] = [];

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    setParams: (...args: unknown[]) => mockSetParams(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/components/common/CompareView', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    CompareView: (props: { leftId?: string; rightId?: string }) => {
      mockCompareView(props);
      return <Text testID="compare-view">compare</Text>;
    },
  };
});

jest.mock('@/data/hooks/useBrowseItems', () => ({
  useBrowseItems: () => ({
    rows: mockRows,
    loading: false,
    searchInput: '',
    setSearchInput: mockSetSearchInput,
  }),
}));

function renderCompare() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <BrowseCompareScreen />
    </SafeAreaProvider>,
  );
}

describe('BrowseCompareScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRows = [
      { kind: 'item', id: 'item-1', primaryForm: '食', meaning: 'eat' },
      { kind: 'item', id: 'item-2', primaryForm: '飲', meaning: 'drink' },
    ];
  });

  it('renders the same CompareView as the review route once both ids are known', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: 'item-1', right: 'item-2' });
    renderCompare();

    expect(mockCompareView).toHaveBeenCalledWith(
      expect.objectContaining({ leftId: 'item-1', rightId: 'item-2' }),
    );
    expect(screen.queryByTestId('compare-picker-list')).toBeNull();
  });

  it('opens the picker when only the left item is known', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: 'item-1' });
    renderCompare();

    expect(screen.getByTestId('compare-picker-list')).toBeTruthy();
    expect(mockCompareView).not.toHaveBeenCalled();
  });

  it('excludes the left item from the picker candidates', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: 'item-1' });
    renderCompare();

    expect(screen.queryByTestId('compare-picker-item-item-1')).toBeNull();
    expect(screen.getByTestId('compare-picker-item-item-2')).toBeTruthy();
  });

  it('sets the right param when a candidate is picked', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: 'item-1' });
    renderCompare();

    fireEvent.press(screen.getByTestId('compare-picker-item-item-2'));
    expect(mockSetParams).toHaveBeenCalledWith({ left: 'item-1', right: 'item-2' });
  });

  it('uses the same param names as the locked review/compare contract', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: ['item-1', 'extra'], right: ['item-2'] });
    renderCompare();

    expect(mockCompareView).toHaveBeenCalledWith(
      expect.objectContaining({ leftId: 'item-1', rightId: 'item-2' }),
    );
  });

  it('offers Back to return to details', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: 'item-1', right: 'item-2' });
    renderCompare();

    fireEvent.press(screen.getByTestId('browse-compare-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
