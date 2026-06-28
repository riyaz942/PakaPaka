import { fireEvent, render, screen } from '@testing-library/react-native';

import { SessionHeader } from './SessionHeader';

describe('SessionHeader', () => {
  const defaultProps = {
    currentIndex: 11,
    totalItems: 42,
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

  it('calls onExitPress when close button is tapped', () => {
    const onExitPress = jest.fn();
    render(<SessionHeader {...defaultProps} onExitPress={onExitPress} />);
    fireEvent.press(screen.getByLabelText('End session'));
    expect(onExitPress).toHaveBeenCalledTimes(1);
  });

  it('has descriptive accessibilityLabel on header container', () => {
    render(<SessionHeader {...defaultProps} cognitiveLoadPercent={0} />);
    expect(
      screen.getByLabelText('Item 12 of 42, cognitive load 0 percent, kanji item'),
    ).toBeTruthy();
  });
});
