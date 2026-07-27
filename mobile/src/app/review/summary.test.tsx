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

jest.mock('expo-router', () => ({
  router: { dismissAll: jest.fn() },
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

jest.mock('@/providers/ReviewSessionProvider', () => ({
  useReviewSession: () => ({ sessionSummary: mockSessionSummary }),
}));

jest.mock('@/data/hooks/useShadowMode', () => ({
  useShadowMode: () => ({ isEnabled: mockShadowModeEnabled }),
}));

let mockGoalPercent = 120;

jest.mock('@/data/hooks/useCognitiveLoad', () => ({
  useCognitiveLoad: () => ({
    percent: mockGoalPercent,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

describe('ReviewSummaryScreen', () => {
  beforeEach(() => {
    mockShadowModeEnabled = false;
    mockGoalPercent = 120;
  });

  it('never renders streak UI (R2 / UX-DR27)', () => {
    render(<ReviewSummaryScreen />);

    expect(screen.queryByTestId('streak-celebration')).toBeNull();
    expect(screen.queryByText(/day streak/)).toBeNull();
  });

  it('shows minutes studied with no multi-app comparison (plan 12.7)', () => {
    render(<ReviewSummaryScreen />);

    expect(screen.getByText('12 min studied')).toBeTruthy();
    expect(screen.queryByText(/separate apps/)).toBeNull();
  });

  it('offers no share action or share card', () => {
    render(<ReviewSummaryScreen />);

    expect(screen.queryByLabelText('Share session summary')).toBeNull();
    expect(screen.queryByTestId('post-session-share-card')).toBeNull();
  });

  it('shows overshoot goal state, never a streak row', () => {
    mockGoalPercent = 120;
    render(<ReviewSummaryScreen />);

    expect(screen.getByTestId('session-goal-state')).toHaveTextContent(
      'Goal met — +20% overshoot',
    );
  });

  it('shows calm partial-goal state when under 100%', () => {
    mockGoalPercent = 60;
    render(<ReviewSummaryScreen />);

    expect(screen.getByTestId('session-goal-state')).toHaveTextContent(
      "60% of today's goal",
    );
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
