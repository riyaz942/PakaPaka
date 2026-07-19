import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ReviewCompareScreen from './compare';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

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

describe('ReviewCompareScreen stub (Story 1.2 — contract locked for Story 4.2)', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ left: '1', right: '2' });
  });

  it('reads the left/right search params and preserves them in the placeholder', () => {
    renderCompare();
    expect(screen.getByText('Compare coming soon')).toBeTruthy();
    expect(screen.getByTestId('review-compare-params')).toHaveTextContent(
      /Side-by-side comparison for items 1 and 2/,
    );
  });

  it('offers Back to return to the prior review screen', () => {
    renderCompare();
    fireEvent.press(screen.getByTestId('review-compare-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('renders a placeholder even with missing params (deep-link safety)', () => {
    mockUseLocalSearchParams.mockReturnValue({});
    renderCompare();
    expect(screen.getByText('Compare coming soon')).toBeTruthy();
  });
});
