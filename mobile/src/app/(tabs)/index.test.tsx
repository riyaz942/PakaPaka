import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from './index';

import { clearReviewPriority, getReviewPriority } from '@/data/reviewPriorityStore';

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

// Stable identity: Home's focus effect depends on the db handles, so a fresh
// object per render would re-run the effect forever once object-valued state
// (e.g. the welcome-back offer) re-renders the screen.
const mockDatabaseContext = { curriculumDb: {}, userDb: {} };

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => mockDatabaseContext,
}));

let mockGreetingSentence: string | null = null;

jest.mock('@/data/curriculum/greetingRepository', () => ({
  getGreetingSentence: () => mockGreetingSentence,
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

// Union return type so tests can simulate failures (pre-existing tsc error fix).
type MockGoalResult =
  | { ok: true; value: undefined }
  | { ok: false; error: { code: string; message: string } };

const mockAcceptPendingRise = jest.fn(
  (): MockGoalResult => ({ ok: true, value: undefined }),
);
const mockAcceptPendingReduction = jest.fn(() => ({ ok: true as const, value: undefined }));
const mockDeclinePendingReduction = jest.fn(() => ({ ok: true as const, value: undefined }));

jest.mock('@/data/user/goalRingRepository', () => ({
  acceptPendingRise: () => mockAcceptPendingRise(),
  acceptPendingReduction: () => mockAcceptPendingReduction(),
  declinePendingReduction: () => mockDeclinePendingReduction(),
}));

const mockRefetchForecast = jest.fn();
let mockForecast: unknown = null;

const mockRefetchReadiness = jest.fn();
let mockReadingTarget: unknown = null;

jest.mock('@/data/hooks/useReadingReadiness', () => ({
  useReadingReadiness: () => ({
    target: mockReadingTarget,
    isLoading: false,
    refetch: mockRefetchReadiness,
  }),
}));

jest.mock('@/data/hooks/useReviewForecast', () => ({
  useReviewForecast: () => ({
    forecast: mockForecast,
    isLoading: false,
    refetch: mockRefetchForecast,
  }),
}));

const mockRefetchAtRisk = jest.fn();
let mockAtRisk = {
  totalCount: 0,
  topItems: [] as { itemId: string; primaryForm: string; meaning: string }[],
  allItems: [] as { itemId: string; primaryForm: string; meaning: string }[],
  rankedItemIds: [] as string[],
};

jest.mock('@/data/hooks/useAtRiskItems', () => ({
  useAtRiskItems: () => ({
    ...mockAtRisk,
    isLoading: false,
    refetch: mockRefetchAtRisk,
  }),
}));

const mockRefetchProgress = jest.fn();

jest.mock('@/data/hooks/useLevelProgress', () => ({
  useLevelProgress: () => ({
    perType: {
      kanji: { started: 10, total: 32 },
      vocabulary: { started: 15, total: 41 },
      grammar: { started: 4, total: 16 },
    },
    overallPercent: 29,
    isLoading: false,
    refetch: mockRefetchProgress,
  }),
}));

let mockOnboardingCompleted = true;

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => 'N5',
  getReducedMotionEnabled: () => null,
  setReducedMotionEnabled: jest.fn(),
  isOnboardingCompleted: () => mockOnboardingCompleted,
}));

let mockLastActiveDate: string | null = null;

jest.mock('@/data/user/cognitiveLoadRepository', () => ({
  ...jest.requireActual('@/data/user/cognitiveLoadRepository'),
  getLastActiveDate: () => mockLastActiveDate,
}));

let mockImportCount = 1;

jest.mock('@/data/user/importRepository', () => ({
  countImportMetadataRows: () => mockImportCount,
}));

let mockShowCurriculumBanner = false;
const mockDismissCurriculumBanner = jest.fn();

jest.mock('@/providers/CurriculumUpdateContext', () => ({
  useCurriculumUpdateBanner: () => ({
    showCurriculumUpdatedBanner: mockShowCurriculumBanner,
    dismissCurriculumUpdatedBanner: mockDismissCurriculumBanner,
  }),
}));

const mockCountServableDueItems = jest.fn();

jest.mock('@/data/reviewEligibility', () => ({
  countServableDueItems: (...args: unknown[]) => mockCountServableDueItems(...args),
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
    mockCountServableDueItems.mockReturnValue(0);
    mockShouldShowSwitchPrompt = false;
    mockShadowModeDaysActive = 0;
    mockPendingRiseTo = null;
    mockPendingReductionTo = null;
    mockGreetingSentence = null;
    mockForecast = null;
    mockReadingTarget = null;
    mockAtRisk = { totalCount: 0, topItems: [], allItems: [], rankedItemIds: [] };
    mockOnboardingCompleted = true;
    mockLastActiveDate = null;
    mockImportCount = 1;
    mockShowCurriculumBanner = false;
    clearReviewPriority();
  });

  function seedBigBacklog(count = 45) {
    mockCountServableDueItems.mockReturnValue(count);
  }

  it('offers welcome-back triage only after absence with a big backlog; CTA starts a capped slice', () => {
    mockLastActiveDate = '2026-07-01';
    seedBigBacklog(45);
    render(<HomeScreen />);

    expect(screen.getByTestId('welcome-back-card')).toBeTruthy();
    expect(screen.getByText('Ease back in: 20 of your 45 due. The rest can wait.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('welcome-back-start'));
    expect(getReviewPriority()).toEqual({ itemIds: [], limit: 20 });
    expect(mockRouterPush).toHaveBeenCalledWith('/review');
  });

  it('does not offer welcome-back without an absence, even with a backlog', () => {
    mockLastActiveDate = null;
    seedBigBacklog(45);
    render(<HomeScreen />);
    expect(screen.queryByTestId('welcome-back-card')).toBeNull();
  });

  it('dismissing welcome-back hides it for the visit without starting anything', () => {
    mockLastActiveDate = '2026-07-01';
    seedBigBacklog(45);
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('welcome-back-dismiss'));
    expect(screen.queryByTestId('welcome-back-card')).toBeNull();
    expect(mockRouterPush).not.toHaveBeenCalledWith('/review');
  });

  it('banner slot shows one banner: welcome-back outranks curriculum update and import nudge', () => {
    mockLastActiveDate = '2026-07-01';
    seedBigBacklog(45);
    mockShowCurriculumBanner = true;
    mockImportCount = 0;
    render(<HomeScreen />);

    expect(screen.getByTestId('welcome-back-card')).toBeTruthy();
    expect(screen.queryByTestId('home-curriculum-updated-card')).toBeNull();
    expect(screen.queryByTestId('import-nudge-card')).toBeNull();
    // Permanent sections still render under the banner.
    expect(screen.getByTestId('home-review-button')).toBeTruthy();
    expect(screen.getByTestId('home-learn-button')).toBeTruthy();
  });

  it('shows the import nudge when no import exists and onboarding is done', () => {
    mockImportCount = 0;
    render(<HomeScreen />);

    expect(screen.getByTestId('import-nudge-card')).toBeTruthy();
    fireEvent.press(screen.getByTestId('import-nudge-open'));
    expect(mockRouterPush).toHaveBeenCalledWith('/settings');
  });

  it('curriculum update card outranks the import nudge', () => {
    mockImportCount = 0;
    mockShowCurriculumBanner = true;
    render(<HomeScreen />);

    expect(screen.getByTestId('home-curriculum-updated-card')).toBeTruthy();
    expect(screen.queryByTestId('import-nudge-card')).toBeNull();
  });

  it('never shows the at-risk section when the count is zero', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('at-risk-section')).toBeNull();
  });

  it('shows the at-risk refresher; CTA hands ranked IDs to the review queue and navigates', () => {
    mockAtRisk = {
      totalCount: 3,
      topItems: [{ itemId: '5', primaryForm: '食べる', meaning: 'to eat' }],
      allItems: [{ itemId: '5', primaryForm: '食べる', meaning: 'to eat' }],
      rankedItemIds: ['5', '9', '12'],
    };
    render(<HomeScreen />);

    expect(screen.getByText('3 items ready for a refresher')).toBeTruthy();
    fireEvent.press(screen.getByTestId('at-risk-start-revision'));
    expect(getReviewPriority()).toEqual({ itemIds: ['5', '9', '12'], limit: 8 });
    expect(mockRouterPush).toHaveBeenCalledWith('/review');
  });

  it('renders reading readiness as a destination and navigates to the passage on tap', () => {
    mockReadingTarget = {
      passageId: '7',
      title: '自己紹介',
      itemsRemainingToUnlock: 4,
      noProgressYet: false,
    };
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('reading-readiness'));
    // Passages live under Browse now (FR63); `/read/[id]` still redirects here.
    expect(mockRouterPush).toHaveBeenCalledWith('/browse/passage/7');
    expect(mockRefetchReadiness).toHaveBeenCalled();
  });

  it('hides reading readiness when there is no locked destination', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('reading-readiness')).toBeNull();
  });

  it('renders the designed forecast empty state when forecast data is not ready yet', () => {
    mockForecast = null;
    render(<HomeScreen />);

    expect(screen.getByTestId('review-forecast')).toBeTruthy();
    expect(screen.getByTestId('review-forecast-empty')).toBeTruthy();
  });

  it('renders the one-week forecast when data is available and refetches it on focus', () => {
    mockForecast = {
      days: [
        { dateKey: '2026-07-20', weekdayLabel: 'Mon', isToday: true, count: 3 },
        { dateKey: '2026-07-21', weekdayLabel: 'Tue', isToday: false, count: 0 },
        { dateKey: '2026-07-22', weekdayLabel: 'Wed', isToday: false, count: 41 },
        { dateKey: '2026-07-23', weekdayLabel: 'Thu', isToday: false, count: 0 },
        { dateKey: '2026-07-24', weekdayLabel: 'Fri', isToday: false, count: 0 },
        { dateKey: '2026-07-25', weekdayLabel: 'Sat', isToday: false, count: 0 },
        { dateKey: '2026-07-26', weekdayLabel: 'Sun', isToday: false, count: 0 },
      ],
      totalCount: 44,
      wallDateKey: '2026-07-22',
    };
    render(<HomeScreen />);

    expect(screen.getByTestId('review-forecast')).toBeTruthy();
    expect(screen.getByTestId('forecast-wall-note')).toBeTruthy();
    expect(mockRefetchForecast).toHaveBeenCalled();
  });

  it('shows the calm fallback greeting on day 1 (no started vocab sentence)', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Welcome back — here’s today at a glance.')).toBeTruthy();
  });

  it('shows a comprehensible sentence from started vocabulary when available', () => {
    mockGreetingSentence = '猫がいます。';
    render(<HomeScreen />);
    expect(screen.getByText('猫がいます。')).toBeTruthy();
  });

  it('renders goal ring, Review and Learn buttons, and progress bar — no streak UI', () => {
    mockCountServableDueItems.mockReturnValue(2);
    render(<HomeScreen />);

    const ring = screen.getByLabelText('Goal 42 percent');
    expect(ring.props.style).toEqual({ width: 160, height: 160 });
    expect(screen.getByText("Today's goal")).toBeTruthy();
    expect(screen.getByRole('button', { name: /start today's lesson/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /review 2 items due/i })).toBeTruthy();
    expect(screen.queryByTestId('home-streak-counter')).toBeNull();
    expect(screen.queryByText(/day streak/)).toBeNull();
    expect(screen.getByText('N5 Progress')).toBeTruthy();
  });

  it('renders Review above Learn (UX-DR3: review-first hierarchy)', () => {
    mockCountServableDueItems.mockReturnValue(2);
    render(<HomeScreen />);

    const buttons = screen.getAllByRole('button');
    const reviewIndex = buttons.findIndex((b) => b.props.testID === 'home-review-button');
    const learnIndex = buttons.findIndex((b) => b.props.testID === 'home-learn-button');
    expect(reviewIndex).toBeGreaterThanOrEqual(0);
    expect(learnIndex).toBeGreaterThanOrEqual(0);
    expect(reviewIndex).toBeLessThan(learnIndex);
    expect(screen.getByText('2 items ready')).toBeTruthy();
  });

  it('refetches goal data on focus (BUG1: no skipped first focus)', () => {
    render(<HomeScreen />);
    expect(mockRefetchLoad).toHaveBeenCalled();
    expect(mockCountServableDueItems).toHaveBeenCalled();
  });

  it('does not render SRS stage breakdown', () => {
    render(<HomeScreen />);
    expect(screen.queryByText('SRS stages')).toBeNull();
    expect(screen.queryByText('Apprentice')).toBeNull();
  });

  it('disables Review button when zero items are due', () => {
    mockCountServableDueItems.mockReturnValue(0);
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
