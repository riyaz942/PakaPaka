import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { GuidanceInfoButton } from '@/components/common/GuidanceInfoButton';

describe('GuidanceInfoButton', () => {
  it('labels itself with the card it explains and clears 44pt', () => {
    render(<GuidanceInfoButton cardId="two-card-kanji" />);

    const button = screen.getByTestId('guidance-info-two-card-kanji');
    expect(button.props.accessibilityLabel).toBe('Explain: Why kanji ask twice');
    expect(button.props.className).toContain('min-h-[44px]');
    expect(button.props.className).toContain('min-w-[44px]');
  });

  it('opens the card in the shared sheet and closes again', () => {
    render(<GuidanceInfoButton cardId="two-card-kanji" />);

    expect(screen.queryByText(/becomes two review cards/)).toBeNull();

    fireEvent.press(screen.getByTestId('guidance-info-two-card-kanji'));
    expect(screen.getByText('Why kanji ask twice')).toBeTruthy();
    expect(screen.getByText(/becomes two review cards/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('explainer-sheet-close'));
    expect(screen.queryByText(/becomes two review cards/)).toBeNull();
  });

  it('renders the guidance card with no subject', () => {
    render(<GuidanceInfoButton cardId="spaced-repetition" testID="stage-info" />);

    fireEvent.press(screen.getByTestId('stage-info'));
    expect(screen.getByText(/pushes the next sighting further out/)).toBeTruthy();
    expect(screen.queryByText(/You have met/)).toBeNull();
  });
});
