import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ReviewCompareScreen from './compare';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockCompareView = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

// The comparison UI has its own tests; here we only assert the route contract —
// which ids reach CompareView, and that the header/back behaviour is unchanged.
jest.mock('@/components/common/CompareView', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    CompareView: (props: { leftId?: string; rightId?: string }) => {
      mockCompareView(props);
      return <Text testID="compare-view">compare</Text>;
    },
  };
});

function renderCompare() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <ReviewCompareScreen />
    </SafeAreaProvider>,
  );
}

describe('ReviewCompareScreen (Story 1.2 contract, Story 4.2 body)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockCompareView.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ left: '1', right: '2' });
  });

  it('passes the left/right search params through to CompareView', () => {
    renderCompare();
    expect(screen.getByTestId('compare-view')).toBeTruthy();
    expect(mockCompareView).toHaveBeenCalledWith(
      expect.objectContaining({ leftId: '1', rightId: '2' }),
    );
  });

  it('offers Back to return to the prior review screen', () => {
    renderCompare();
    fireEvent.press(screen.getByTestId('review-compare-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders without crashing on missing params (deep-link safety)', () => {
    mockUseLocalSearchParams.mockReturnValue({});
    renderCompare();
    expect(mockCompareView).toHaveBeenCalledWith(
      expect.objectContaining({ leftId: undefined, rightId: undefined }),
    );
  });

  it('normalizes string[] search params to the first value', () => {
    mockUseLocalSearchParams.mockReturnValue({ left: ['1', 'extra'], right: ['2'] });
    renderCompare();
    expect(mockCompareView).toHaveBeenCalledWith(
      expect.objectContaining({ leftId: '1', rightId: '2' }),
    );
  });
});
