import { render, screen } from '@testing-library/react-native';

import { StreakCounter } from './StreakCounter';

describe('StreakCounter', () => {
  it('renders active streak with flame and label', () => {
    render(<StreakCounter currentStreak={5} streakState="active" testID="streak-counter" />);

    expect(screen.getByText('🔥')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Current streak')).toBeTruthy();
    expect(screen.getByLabelText('Current streak: 5 days')).toBeTruthy();
  });

  it('renders at-risk streak with sub-label', () => {
    render(<StreakCounter currentStreak={3} streakState="at-risk" />);

    expect(screen.getByText('Review today to keep it!')).toBeTruthy();
    expect(
      screen.getByLabelText('Current streak: 3 days. Review today to keep it!'),
    ).toBeTruthy();
  });

  it('renders broken streak with restart message', () => {
    render(<StreakCounter currentStreak={0} streakState="broken" />);

    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('Start a new streak today!')).toBeTruthy();
    expect(
      screen.getByLabelText('Streak broken: 0 days. Start a new streak today!'),
    ).toBeTruthy();
  });
});
