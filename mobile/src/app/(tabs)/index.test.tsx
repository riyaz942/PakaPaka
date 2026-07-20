import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from './index';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  // BUG1: Home fetches on focus only, so the mock must actually run the
  // callback (as an effect) — a no-op mock would render a permanent spinner.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(cb, [cb]);
  },
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {} }),
}));

const mockRefetchLoad = jest.fn();
let mockPendingRiseTo: number | null = null;
let mockPendingReductionTo: number | null = null;

jest.mock('@/data/hooks/useCognitiveLoad', () => ({
  useCognitiveLoad: () => ({
    todayLoad: 13,
    threshold: 30,
    percent: 42,
    isComplete: false,
    isOvershoot: false,
    pendingRiseTo: mockPendingRiseTo,
    pendingReductionTo: mockPendingReductionTo,
    isLoading: false,
    error: null,
    refetch: mockRefetchLoad,
  }),
}));

const mockAcceptPendingRise = jest.fn(() => ({ ok: true as const, value: undefined }));
const mockAcceptPendingReduction = jest.fn(() => ({ ok: true as const, value: undefined }));
const mockDeclinePendingReduction = jest.fn(() => ({ ok: true as const, value: undefined }));

jest.mock('@/data/user/goalRingRepository', () => ({
  acceptPendingRise: () => mockAcceptPendingRise(),
  acceptPendingReduction: () => mockAcceptPendingReduction(),
  declinePendingReduction: () => mockDeclinePendingReduction(),
}));

jest.mock('@/data/hooks/useStreak', () => ({
  useStreak: () => ({
    currentStreak: 5,
    streakState: 'active',
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useLevelProgress', () => ({
  useLevelProgress: () => ({
    perType: {
      kanji: { started: 10, total: 32 },
      vocabulary: { started: 15, total: 41 },
      grammar: { started: 4, total: 16 },
    },
    overallPercent: 29,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => 'N5',
  getReducedMotionEnabled: () => null,
  setReducedMotionEnabled: jest.fn(),
}));

const mockGetDueSrsStates = jest.fn();

jest.mock('@/data/user/srsStateRepository', () => ({
  getDueSrsStates: (...args: unknown[]) => mockGetDueSrsStates(...args),
}));

const mockShadowModeDisable = jest.fn();
const mockShadowModeDismissPrompt = jest.fn();
const mockShadowModeSnoozePrompt = jest.fn();
const mockShadowModeRefetch = jest.fn();

let mockShouldShowSwitchPrompt = false;
let mockShadowModeDaysActive = 0;

jest.mock('@/data/hooks/useShadowMode', () => ({
  useShadowMode: () => ({
    daysActive: mockShadowModeDaysActive,
    shouldShowSwitchPrompt: mockShouldShowSwitchPrompt,
    disable: mockShadowModeDisable,
    dismissPrompt: mockShadowModeDismissPrompt,
    snoozePrompt: mockShadowModeSnoozePrompt,
    refetch: mockShadowModeRefetch,
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDueSrsStates.mockReturnValue([]);
    mockShouldShowSwitchPrompt = false;
    mockShadowModeDaysActive = 0;
    mockPendingRiseTo = null;
    mockPendingReductionTo = null;
  });

  it('renders goal ring, Review and Learn buttons, streak, and progress bar', () => {
    mockGetDueSrsStates.mockReturnValue([{ itemId: '1' }, { itemId: '2' }]);
    render(<HomeScreen />);

    const ring = screen.getByLabelText('Goal 42 percent');
    expect(ring.props.style).toEqual({ width: 160, height: 160 });
    expect(screen.getByText("Today's goal")).toBeTruthy();
    expect(screen.getByRole('button', { name: /start today's lesson/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /review 2 items due/i })).toBeTruthy();
    expect(screen.getByTestId('home-streak-counter')).toBeTruthy();
    expect(screen.getByText('N5 Progress')).toBeTruthy();
  });

  it('refetches goal data on focus (BUG1: no skipped first focus)', () => {
    render(<HomeScreen />);
    expect(mockRefetchLoad).toHaveBeenCalled();
    expect(mockGetDueSrsStates).toHaveBeenCalled();
  });

  it('does not render SRS stage breakdown', () => {
    render(<HomeScreen />);
    expect(screen.queryByText('SRS stages')).toBeNull();
    expect(screen.queryByText('Apprentice')).toBeNull();
  });

  it('disables Review button when zero items are due', () => {
    mockGetDueSrsStates.mockReturnValue([]);
    render(<HomeScreen />);

    const reviewButton = screen.getByRole('button', { name: /all caught up/i });
    expect(reviewButton.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('All caught up')).toBeTruthy();
  });

  it('shows no goal prompts when nothing is pending', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('goal-rise-prompt')).toBeNull();
    expect(screen.queryByTestId('goal-reduction-prompt')).toBeNull();
  });

  it('shows the rise prompt when a rise is pending; accepting persists and refetches', () => {
    mockPendingRiseTo = 45;
    render(<HomeScreen />);

    expect(screen.getByTestId('goal-rise-prompt')).toBeTruthy();
    fireEvent.press(screen.getByTestId('goal-rise-accept'));
    expect(mockAcceptPendingRise).toHaveBeenCalledTimes(1);
    expect(mockRefetchLoad).toHaveBeenCalled();
  });

  it('does not refetch when accepting a rise fails', () => {
    mockPendingRiseTo = 45;
    mockAcceptPendingRise.mockReturnValueOnce({
      ok: false as const,
      error: { code: 'goal_ring_persist_failed', message: 'fail' },
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockRefetchLoad.mockClear();
    render(<HomeScreen />);
    const callsAfterMount = mockRefetchLoad.mock.calls.length;

    fireEvent.press(screen.getByTestId('goal-rise-accept'));
    expect(mockAcceptPendingRise).toHaveBeenCalledTimes(1);
    expect(mockRefetchLoad).toHaveBeenCalledTimes(callsAfterMount);
    warnSpy.mockRestore();
  });

  it('dismissing the rise prompt hides it without accepting', () => {
    mockPendingRiseTo = 45;
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('goal-rise-dismiss'));
    expect(screen.queryByTestId('goal-rise-prompt')).toBeNull();
    expect(mockAcceptPendingRise).not.toHaveBeenCalled();
  });

  it('shows the reduction offer when pending; declining clears it', () => {
    mockPendingReductionTo = 20;
    render(<HomeScreen />);

    expect(screen.getByTestId('goal-reduction-prompt')).toBeTruthy();
    fireEvent.press(screen.getByTestId('goal-reduction-decline'));
    expect(mockDeclinePendingReduction).toHaveBeenCalledTimes(1);
  });

  it('does not render the shadow mode switch prompt when shouldShowSwitchPrompt is false (feature off or <14 days)', () => {
    mockShouldShowSwitchPrompt = false;
    render(<HomeScreen />);
    expect(screen.queryByText(/ready to switch fully/i)).toBeNull();
  });

  it('renders the shadow mode switch prompt when shouldShowSwitchPrompt is true (>=14 days)', () => {
    mockShouldShowSwitchPrompt = true;
    mockShadowModeDaysActive = 14;
    render(<HomeScreen />);
    expect(screen.getByText("You've been comparing for 14 days")).toBeTruthy();
  });
});
