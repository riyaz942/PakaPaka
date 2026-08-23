import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { CompareEntryPoint } from '@/components/learn/CompareEntryPoint';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

describe('CompareEntryPoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the Browse compare picker with this item as the left side', () => {
    render(<CompareEntryPoint itemId="vocab-1" itemType="vocabulary" />);

    fireEvent.press(screen.getByTestId('compare-entry-point'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/browse/compare',
      params: { left: 'vocab-1', leftType: 'vocabulary' },
    });
  });

  it('renders nothing inside a review session', () => {
    // Pushing /browse/* from a review would leave the review Stack; the review
    // surface reaches Compare through its own answer-collision link instead.
    render(
      <ItemLinkProvider base="/review/item">
        <CompareEntryPoint itemId="vocab-1" itemType="vocabulary" />
      </ItemLinkProvider>,
    );

    expect(screen.queryByTestId('compare-entry-point')).toBeNull();
  });

  it('renders on the Browse details surface', () => {
    render(
      <ItemLinkProvider base="/browse/item">
        <CompareEntryPoint itemId="vocab-1" itemType="vocabulary" />
      </ItemLinkProvider>,
    );

    expect(screen.getByTestId('compare-entry-point')).toBeTruthy();
  });

  it('renders nothing for grammar, even on the Browse details surface', () => {
    render(
      <ItemLinkProvider base="/browse/item">
        <CompareEntryPoint itemId="grammar-1" itemType="grammar" />
      </ItemLinkProvider>,
    );

    expect(screen.queryByTestId('compare-entry-point')).toBeNull();
  });
});
