import { render, screen, within } from '@testing-library/react-native';

import StatsScreen from './stats';

jest.mock('expo-router', () => ({
  // Stats refetches on every focus (BUG1 pattern) — run the callback as an effect.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(cb, [cb]);
  },
}));

const mockRefetchDaysStudied = jest.fn();
let mockDaysStudied = 0;

jest.mock('@/data/hooks/useDaysStudied', () => ({
  useDaysStudied: () => ({
    daysStudied: mockDaysStudied,
    isLoading: false,
    refetch: mockRefetchDaysStudied,
  }),
}));

let mockSrsTotal = 10;

jest.mock('@/data/hooks/useSRSBreakdown', () => ({
  useSRSBreakdown: () => ({
    counts: { apprentice: 4, guru: 3, master: 2, enlightened: 1, burned: 0 },
    total: mockSrsTotal,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useWeaknessStats', () => ({
  useWeaknessStats: () => ({
    stats: mockSrsTotal > 0 ? [{ itemId: '1' }] : [],
    clusters: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

describe('StatsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDaysStudied = 0;
    mockSrsTotal = 10;
  });

  it('shows days studied this month near the top with calm copy', () => {
    mockDaysStudied = 8;
    render(<StatsScreen />);

    expect(screen.getByTestId('days-studied-stat')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Calm activity — not a streak')).toBeTruthy();
  });

  it('shows 0 calmly when SRS exists but no study days this month', () => {
    mockDaysStudied = 0;
    render(<StatsScreen />);

    const stat = screen.getByTestId('days-studied-stat');
    expect(within(stat).getByText('0')).toBeTruthy();
  });

  it('keeps the first-run empty state when nothing exists yet', () => {
    mockSrsTotal = 0;
    render(<StatsScreen />);

    expect(screen.queryByTestId('days-studied-stat')).toBeNull();
  });

  it('refetches days studied on focus, including the first (BUG1 mirror)', () => {
    render(<StatsScreen />);
    expect(mockRefetchDaysStudied).toHaveBeenCalled();
  });
});
