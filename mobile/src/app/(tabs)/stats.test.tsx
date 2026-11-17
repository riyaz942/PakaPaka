import { render, screen, within } from '@testing-library/react-native';

import StatsScreen from './stats';

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

jest.mock('expo-router', () => ({
  // Stats refetches on every focus (BUG1 pattern) — run the callback as an effect.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(cb, [cb]);
  },
}));

// Signed out: sync stays idle, so the screen never reloads for a merge.
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => ({
    phase: 'idle',
    lastSyncedAt: null,
    error: null,
    conflicts: null,
    appliedVersion: 0,
  }),
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
    expect(screen.getByText('this month · not a streak')).toBeTruthy();
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
    expect(screen.queryByTestId('items-tracked-stat')).toBeNull();
  });

  it('pairs days studied with the tracked-item count, and never a streak', () => {
    mockDaysStudied = 8;
    render(<StatsScreen />);

    expect(within(screen.getByTestId('items-tracked-stat')).getByText('10')).toBeTruthy();
    expect(screen.getByText('Items in review')).toBeTruthy();
    expect(screen.queryByText('Day streak')).toBeNull();
  });

  it('refetches days studied on focus, including the first (BUG1 mirror)', () => {
    render(<StatsScreen />);
    expect(mockRefetchDaysStudied).toHaveBeenCalled();
  });
});
