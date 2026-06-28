import { render, screen } from '@testing-library/react-native';

import { StatsEmptyState, WeaknessEmptySubState } from './StatsEmptyState';

describe('StatsEmptyState', () => {
  it('renders the default first-launch message', () => {
    render(<StatsEmptyState />);
    expect(screen.getByText('Complete your first session to see stats here.')).toBeTruthy();
  });

  it('renders a custom message when provided', () => {
    render(<StatsEmptyState message="Custom message here." />);
    expect(screen.getByText('Custom message here.')).toBeTruthy();
  });

  it('renders the illustration with accessibility label', () => {
    render(<StatsEmptyState />);
    expect(screen.getByLabelText('Stats illustration')).toBeTruthy();
  });
});

describe('WeaknessEmptySubState', () => {
  it('renders the no-clusters encouraging message', () => {
    render(<WeaknessEmptySubState />);
    expect(
      screen.getByText('No weak patterns detected yet — keep reviewing.'),
    ).toBeTruthy();
  });

  it('does not apply full-page centering layout', () => {
    const { toJSON } = render(<WeaknessEmptySubState />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain('mt-8');
  });
});
