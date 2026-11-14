import { fireEvent, render, screen } from '@testing-library/react-native';

import { SessionHeader } from './SessionHeader';

jest.mock('@/data/hooks/useHaptics', () => ({
  useHaptics: () => ({ play: jest.fn() }),
  useHapticsPreference: () => ({
    hapticsEnabled: true,
    setHapticsEnabled: jest.fn(),
    refetch: jest.fn(),
  }),
}));

// Reduced motion draws the rings and bars at their final value at once.
jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

describe('SessionHeader', () => {
  const defaultProps = {
    cardsCompleted: 11,
    totalCards: 42,
    itemType: 'kanji' as const,
    onExitPress: jest.fn(),
  };

  it('shows progress in "N of M" format', () => {
    render(<SessionHeader {...defaultProps} />);
    expect(screen.getByText('12 of 42')).toBeTruthy();
  });

  it('shows uppercase badge label for kanji', () => {
    render(<SessionHeader {...defaultProps} />);
    expect(screen.getByText('KANJI')).toBeTruthy();
  });

  it('shows uppercase badge label for radical', () => {
    render(<SessionHeader {...defaultProps} itemType="radical" />);
    expect(screen.getByText('RADICAL')).toBeTruthy();
  });

  it('shows uppercase badge label for vocabulary', () => {
    render(<SessionHeader {...defaultProps} itemType="vocabulary" />);
    expect(screen.getByText('VOCABULARY')).toBeTruthy();
  });

  it('shows uppercase badge label for grammar', () => {
    render(<SessionHeader {...defaultProps} itemType="grammar" />);
    expect(screen.getByText('GRAMMAR')).toBeTruthy();
  });

  it('clamps progress to totalCards while retry cards are still showing', () => {
    render(<SessionHeader {...defaultProps} cardsCompleted={42} totalCards={42} />);
    expect(screen.getByText('42 of 42')).toBeTruthy();
  });

  it('advances per completed card under a two-card kanji queue (FR86 / BUG4)', () => {
    // 3 items where one kanji expanded to two cards → 4 total cards. After the
    // first card of the pair completes, the header must already move to 2 of 4
    // — never waiting on the pair's worst-of-both FSRS write.
    const { rerender } = render(
      <SessionHeader {...defaultProps} cardsCompleted={0} totalCards={4} />,
    );
    expect(screen.getByText('1 of 4')).toBeTruthy();

    rerender(<SessionHeader {...defaultProps} cardsCompleted={1} totalCards={4} />);
    expect(screen.getByText('2 of 4')).toBeTruthy();
  });

  it('calls onExitPress when close button is tapped', () => {
    const onExitPress = jest.fn();
    render(<SessionHeader {...defaultProps} onExitPress={onExitPress} />);
    fireEvent.press(screen.getByLabelText('End session'));
    expect(onExitPress).toHaveBeenCalledTimes(1);
  });

  it('uses card-oriented wording in the accessibilityLabel (Story 1.2)', () => {
    render(<SessionHeader {...defaultProps} cognitiveLoadPercent={0} />);
    expect(
      screen.getByLabelText('Card 12 of 42, goal 0 percent, kanji card'),
    ).toBeTruthy();
  });
});
