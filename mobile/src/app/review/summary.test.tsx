import { render, screen } from '@testing-library/react-native';

import ReviewSummaryScreen from './summary';

const mockSessionSummary = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  itemsReviewed: 15,
  correctCount: 13,
  durationMs: 12 * 60_000,
  sessionEndAt: new Date('2026-06-29T12:00:00.000Z').getTime(),
};

let mockShadowModeEnabled = false;
let mockCelebration = { shouldCelebrate: false, currentStreak: 0 };

jest.mock('expo-router', () => ({
  router: { dismissAll: jest.fn() },
}));

jest.mock('@/data/hooks/useStreakCelebration', () => ({
  useStreakCelebration: () => mockCelebration,
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

jest.mock('@/providers/ReviewSessionProvider', () => ({
  useReviewSession: () => ({ sessionSummary: mockSessionSummary }),
}));

jest.mock('@/data/hooks/useStreak', () => ({
  useStreak: () => ({ currentStreak: 3 }),
}));

jest.mock('@/data/hooks/useShadowMode', () => ({
  useShadowMode: () => ({ isEnabled: mockShadowModeEnabled }),
}));

describe('ReviewSummaryScreen', () => {
  beforeEach(() => {
    mockShadowModeEnabled = false;
    mockCelebration = { shouldCelebrate: false, currentStreak: 0 };
  });

  it('renders the streak celebration when today earned it', () => {
    mockCelebration = { shouldCelebrate: true, currentStreak: 4 };
    render(<ReviewSummaryScreen />);

    expect(screen.getByTestId('streak-celebration')).toBeTruthy();
    expect(screen.getByText('4 day streak')).toBeTruthy();
  });

  it('does not render the streak celebration when already celebrated today', () => {
    render(<ReviewSummaryScreen />);

    expect(screen.queryByTestId('streak-celebration')).toBeNull();
  });

  it('shows first-try accuracy so retried items are not counted as correct', () => {
    render(<ReviewSummaryScreen />);

    expect(screen.getByText('13 of 15 correct first try')).toBeTruthy();
  });

  it('renders exactly today behavior (no comparison block) when shadow mode is off', () => {
    render(<ReviewSummaryScreen />);

    expect(screen.queryByText('Shadow mode — compare your session')).toBeNull();
  });

  it('renders the comparison block when shadow mode is enabled and items were reviewed', () => {
    mockShadowModeEnabled = true;
    render(<ReviewSummaryScreen />);

    expect(screen.getByText('Shadow mode — compare your session')).toBeTruthy();
    expect(screen.getByText('Retention: 87%')).toBeTruthy();
  });

  it('does not render the comparison block when shadow mode is enabled but no items were reviewed', () => {
    mockShadowModeEnabled = true;
    mockSessionSummary.itemsReviewed = 0;
    mockSessionSummary.correctCount = 0;

    render(<ReviewSummaryScreen />);

    expect(screen.queryByText('Shadow mode — compare your session')).toBeNull();
    expect(screen.getByText('No items reviewed this session.')).toBeTruthy();

    // restore for other tests
    mockSessionSummary.itemsReviewed = 15;
    mockSessionSummary.correctCount = 13;
  });
});
