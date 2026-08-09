import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { SpacedRepetitionCard } from '@/components/onboarding/cards/SpacedRepetitionCard';

describe('SpacedRepetitionCard', () => {
  it('names the item that triggered it', () => {
    render(<SpacedRepetitionCard subject="水" />);

    expect(screen.getByText(/水/)).toBeTruthy();
    expect(screen.getByText(/pushes the next sighting further out/)).toBeTruthy();
  });

  it('explains itself with no example line when there is no subject', () => {
    render(<SpacedRepetitionCard />);

    expect(screen.getByText(/pushes the next sighting further out/)).toBeTruthy();
    // No stand-in item, and no leftover placeholder where one would have gone.
    expect(screen.queryByText(/You have met/)).toBeNull();
    expect(screen.queryByText(/undefined|\{|\}/)).toBeNull();
  });
});
