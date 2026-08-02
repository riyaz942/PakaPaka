import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { FuriganaOverrideControl } from '@/components/learn/FuriganaOverrideControl';

const mockSetOverride = jest.fn();
const mockClearOverride = jest.fn();
let mockOverrides = new Map<string, 'shown' | 'hidden'>();

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'auto',
    setMode: jest.fn(),
    knownKanji: new Set(),
    refreshKnownKanji: jest.fn(),
    overrides: mockOverrides,
    modeForItem: (itemId: string) => mockOverrides.get(itemId) ?? 'auto',
    setOverride: mockSetOverride,
    clearOverride: mockClearOverride,
    clearAllOverrides: jest.fn(),
  }),
}));

describe('FuriganaOverrideControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverrides = new Map();
  });

  it('marks "Follow progress" selected when the word has no override', () => {
    render(<FuriganaOverrideControl itemId="vocab-1" />);

    expect(
      screen.getByTestId('furigana-override-auto').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('marks the stored override selected', () => {
    mockOverrides = new Map([['vocab-1', 'hidden']]);
    render(<FuriganaOverrideControl itemId="vocab-1" />);

    expect(
      screen.getByTestId('furigana-override-hidden').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('furigana-override-auto').props.accessibilityState.selected,
    ).toBe(false);
  });

  it('persists a definite choice', () => {
    render(<FuriganaOverrideControl itemId="vocab-1" />);

    fireEvent.press(screen.getByTestId('furigana-override-shown'));
    expect(mockSetOverride).toHaveBeenCalledWith('vocab-1', 'shown');
  });

  it('clears the override when returning to "Follow progress"', () => {
    mockOverrides = new Map([['vocab-1', 'shown']]);
    render(<FuriganaOverrideControl itemId="vocab-1" />);

    fireEvent.press(screen.getByTestId('furigana-override-auto'));
    expect(mockClearOverride).toHaveBeenCalledWith('vocab-1');
    expect(mockSetOverride).not.toHaveBeenCalled();
  });

  it('is an explicit control, not a gesture — every choice is a tappable button', () => {
    // FR79 reserves tapping the word itself for the stateless peek, so setting
    // a persistent override needs its own affordance.
    render(<FuriganaOverrideControl itemId="vocab-1" />);

    for (const testID of [
      'furigana-override-auto',
      'furigana-override-shown',
      'furigana-override-hidden',
    ]) {
      expect(screen.getByTestId(testID).props.accessibilityRole).toBe('radio');
    }
  });
});
