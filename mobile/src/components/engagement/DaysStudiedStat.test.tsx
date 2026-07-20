import { render, screen } from '@testing-library/react-native';

import { DaysStudiedStat } from './DaysStudiedStat';

describe('DaysStudiedStat', () => {
  it('renders the count with calm framing and no flame or streak language', () => {
    render(<DaysStudiedStat daysStudied={12} />);

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Days studied this month')).toBeTruthy();
    expect(screen.getByText('Calm activity — not a streak')).toBeTruthy();
    expect(screen.queryByText(/🔥/)).toBeNull();
    expect(screen.queryByText(/day streak/)).toBeNull();
  });

  it('shows zero calmly', () => {
    render(<DaysStudiedStat daysStudied={0} />);

    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.queryByText(/at risk/i)).toBeNull();
  });
});
