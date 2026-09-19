import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import HomeScreen from './index';

import { serializeHomeLayout } from '@/core/engagement/homeLayout';
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

let mockLoadPercent = 42;
let mockIsOvershoot = false;

jest.mock('@/data/hooks/useCognitiveLoad', () => ({
  useCognitiveLoad: () => ({
    todayLoad: 13,
    threshold: 30,
    percent: mockLoadPercent,
    isComplete: mockLoadPercent >= 100,
    isOvershoot: mockIsOvershoot,
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
type MockAtRiskItem = {
  itemId: string;
  primaryForm: string;
  meaning: string;
  itemType: 'radical' | 'kanji' | 'vocabulary' | 'grammar';
};

let mockAtRisk = {
  totalCount: 0,
  topItems: [] as MockAtRiskItem[],
  allItems: [] as MockAtRiskItem[],
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

// Raw stored value, same shape as the `home_layout` preference row. Routed
// through the real reconciler so tests exercise the actual required-section
// and ordering guarantees, not a re-implementation of them.
let mockHomeLayoutStored: string | null = null;

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => 'N5',
  getReducedMotionEnabled: () => null,
  setReducedMotionEnabled: jest.fn(),
  isOnboardingCompleted: () => mockOnboardingCompleted,
  getLastBackedUpAt: () => mockLastBackedUpAt,
  getHomeLayout: () => {
    const { reconcileHomeLayout } = jest.requireActual('@/core/engagement/homeLayout');
    return reconcileHomeLayout(mockHomeLayoutStored);
  },
}));

let mockLastBackedUpAt: string | null = null;

/**
 * The backup nudge is web-only, so its tests have to move `Platform.OS`.
 * `Platform` is a plain module object here — defineProperty is the only way in,
 * and every test restores the native default.
 */
function setPlatform(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

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

let mockOnVacation = false;
let mockVacationReadThrows = false;

jest.mock('@/data/user/vacationRepository', () => ({
  isVacationActive: () => {
    if (mockVacationReadThrows) throw new Error('vacation read failed');
    return mockOnVacation;
  },
}));

/** In-memory stand-in for the `card_seen` table (Epic 7). */
const mockSeenGuidanceCards = new Set<string>();

jest.mock('@/data/user/cardSeenRepository', () => ({
  isCardSeen: (_userDb: unknown, cardId: string) => mockSeenGuidanceCards.has(cardId),
  markCardSeen: (_userDb: unknown, cardId: string) => {
    mockSeenGuidanceCards.add(cardId);
  },
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
    mockLastBackedUpAt = null;
    mockHomeLayoutStored = null;
    setPlatform('ios');
    mockOnVacation = false;
    mockLoadPercent = 42;
    mockIsOvershoot = false;
    mockSeenGuidanceCards.clear();
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
      topItems: [
        { itemId: '5', primaryForm: '食べる', meaning: 'to eat', itemType: 'vocabulary' },
      ],
      allItems: [
        { itemId: '5', primaryForm: '食べる', meaning: 'to eat', itemType: 'vocabulary' },
      ],
      rankedItemIds: ['5', '9', '12'],
    };
    render(<HomeScreen />);

    expect(
      screen.getByText('3 items are slipping — this session will target them first.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('at-risk-start-revision'));
    expect(getReviewPriority()).toEqual({ itemIds: ['5', '9', '12'], limit: 8 });
    expect(mockRouterPush).toHaveBeenCalledWith('/review');
  });

  it('renders reading readiness as a destination and navigates to the passage on tap', () => {
    mockReadingTarget = {
      passageId: '7',
      title: '自己紹介',
      itemsRemainingToUnlock: 4,
      coverage: 0.55,
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
    expect(screen.getByTestId('home-level-progress-button')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('N5 Progress');
  });

  it('navigates to the all-levels overview when the level progress bar is pressed', () => {
    render(<HomeScreen />);

    const button = screen.getByRole('button', { name: /N5 progress.*View all JLPT levels/ });
    fireEvent.press(button);

    expect(mockRouterPush).toHaveBeenCalledWith({ pathname: '/levels', params: { level: 'N5' } });
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

  describe('vacation mode', () => {
    it('replaces the goal ring with the vacation card', () => {
      mockOnVacation = true;
      render(<HomeScreen />);

      expect(screen.getByTestId('home-vacation-card')).toBeTruthy();
      expect(screen.queryByText("Today's goal")).toBeNull();
    });

    it('disables both Review and Learn', () => {
      mockOnVacation = true;
      seedBigBacklog(45);
      render(<HomeScreen />);

      expect(screen.getByTestId('home-review-button').props.accessibilityState.disabled).toBe(
        true,
      );
      expect(screen.getByTestId('home-learn-button').props.accessibilityState.disabled).toBe(
        true,
      );
    });

    it('never quotes the backlog that is still accruing behind the pause', () => {
      mockOnVacation = true;
      seedBigBacklog(45);
      render(<HomeScreen />);

      expect(mockCountServableDueItems).not.toHaveBeenCalled();
      expect(screen.queryByText(/45 items ready/)).toBeNull();
    });

    it('hides the forecast, at-risk section and goal prompts', () => {
      mockOnVacation = true;
      mockPendingRiseTo = 40;
      mockPendingReductionTo = 20;
      mockAtRisk = {
        totalCount: 3,
        topItems: [
          { itemId: '1', primaryForm: '水', meaning: 'water', itemType: 'vocabulary' },
        ],
        allItems: [
          { itemId: '1', primaryForm: '水', meaning: 'water', itemType: 'vocabulary' },
        ],
        rankedItemIds: ['1'],
      };
      render(<HomeScreen />);

      expect(screen.queryByTestId('review-forecast')).toBeNull();
      expect(screen.queryByTestId('goal-rise-prompt')).toBeNull();
      expect(screen.queryByTestId('goal-reduction-prompt')).toBeNull();
    });

    it('routes to Settings from the vacation card', () => {
      mockOnVacation = true;
      render(<HomeScreen />);

      fireEvent.press(screen.getByTestId('home-vacation-settings-link'));
      expect(mockRouterPush).toHaveBeenCalledWith('/settings');
    });

    it('restores the goal ring and CTAs once vacation is off', () => {
      mockOnVacation = false;
      seedBigBacklog(45);
      render(<HomeScreen />);

      expect(screen.queryByTestId('home-vacation-card')).toBeNull();
      expect(screen.getByText("Today's goal")).toBeTruthy();
      expect(screen.getByTestId('home-review-button').props.accessibilityState.disabled).toBe(
        false,
      );
    });
  });
});

describe('HomeScreen — goal overshoot guidance (Epic 7)', () => {
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
    mockLastBackedUpAt = null;
    mockHomeLayoutStored = null;
    setPlatform('ios');
    mockOnVacation = false;
    mockVacationReadThrows = false;
    mockLoadPercent = 42;
    mockIsOvershoot = false;
    mockSeenGuidanceCards.clear();
    clearReviewPriority();
  });

  it('explains the ring the first time it goes past 100%', () => {
    mockLoadPercent = 140;
    mockIsOvershoot = true;

    render(<HomeScreen />);

    expect(screen.getByTestId('guidance-card-notice-goal-overshoot')).toBeTruthy();
    expect(screen.getByText('Past 100% is the good part')).toBeTruthy();
    expect(mockSeenGuidanceCards.has('goal-overshoot')).toBe(true);
  });

  it('says nothing while the ring is still short of the goal', () => {
    render(<HomeScreen />);

    expect(screen.queryByTestId('guidance-card-notice-goal-overshoot')).toBeNull();
    expect(mockSeenGuidanceCards.has('goal-overshoot')).toBe(false);
  });

  it('stays quiet on vacation, where the ring is not shown at all', () => {
    mockOnVacation = true;
    mockLoadPercent = 140;
    mockIsOvershoot = true;

    render(<HomeScreen />);

    expect(screen.getByTestId('home-vacation-card')).toBeTruthy();
    expect(screen.queryByTestId('guidance-card-notice-goal-overshoot')).toBeNull();
    expect(mockSeenGuidanceCards.has('goal-overshoot')).toBe(false);
  });

  it('stays quiet when the vacation read fails, rather than firing on a guess', () => {
    mockLoadPercent = 140;
    mockIsOvershoot = true;
    mockVacationReadThrows = true;

    render(<HomeScreen />);

    expect(screen.queryByTestId('guidance-card-notice-goal-overshoot')).toBeNull();
    expect(mockSeenGuidanceCards.has('goal-overshoot')).toBe(false);
  });

  it('offers the same explanation on demand from the goal card', () => {
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('guidance-info-goal-overshoot'));
    expect(screen.getByText('Past 100% is the good part')).toBeTruthy();
    // Asking never consumes the just-in-time moment.
    expect(mockSeenGuidanceCards.has('goal-overshoot')).toBe(false);
  });

  describe('web backup nudge (Story 9.2, AC6)', () => {
    beforeEach(() => {
      mockLastBackedUpAt = null;
      mockLastActiveDate = null;
      mockShowCurriculumBanner = false;
      mockImportCount = 1;
      mockCountServableDueItems.mockReturnValue(0);
      setPlatform('ios');
    });

    afterEach(() => {
      setPlatform('ios');
    });

    /** Old enough to be past the ~7-day browser eviction window. */
    const STALE = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    const FRESH = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    it('never appears on native, even with no backup at all', () => {
      setPlatform('ios');
      mockLastBackedUpAt = null;
      mockImportCount = 1;
      render(<HomeScreen />);

      expect(screen.queryByTestId('backup-nudge-card')).toBeNull();
    });

    it('appears on web when the device has never been backed up', () => {
      setPlatform('web');
      mockLastBackedUpAt = null;
      render(<HomeScreen />);

      expect(screen.getByTestId('backup-nudge-card')).toBeTruthy();
      fireEvent.press(screen.getByTestId('backup-nudge-open'));
      expect(mockRouterPush).toHaveBeenCalledWith('/settings');
    });

    it('appears on web once the last backup is past the eviction window', () => {
      setPlatform('web');
      mockLastBackedUpAt = STALE;
      render(<HomeScreen />);

      expect(screen.getByTestId('backup-nudge-card')).toBeTruthy();
    });

    it('stays hidden while the backup is recent', () => {
      setPlatform('web');
      mockLastBackedUpAt = FRESH;
      render(<HomeScreen />);

      expect(screen.queryByTestId('backup-nudge-card')).toBeNull();
    });

    it('dismisses for the visit without writing a preference', () => {
      setPlatform('web');
      mockLastBackedUpAt = null;
      render(<HomeScreen />);

      fireEvent.press(screen.getByTestId('backup-nudge-dismiss'));

      expect(screen.queryByTestId('backup-nudge-card')).toBeNull();
      expect(mockRouterPush).not.toHaveBeenCalledWith('/settings');
    });

    it('outranks the import nudge but yields to welcome-back and curriculum update', () => {
      setPlatform('web');
      mockLastBackedUpAt = null;
      mockImportCount = 0;
      render(<HomeScreen />);

      expect(screen.getByTestId('backup-nudge-card')).toBeTruthy();
      expect(screen.queryByTestId('import-nudge-card')).toBeNull();

      screen.unmount();
      mockShowCurriculumBanner = true;
      render(<HomeScreen />);
      expect(screen.getByTestId('home-curriculum-updated-card')).toBeTruthy();
      expect(screen.queryByTestId('backup-nudge-card')).toBeNull();

      screen.unmount();
      mockLastActiveDate = '2026-07-01';
      mockCountServableDueItems.mockReturnValue(45);
      render(<HomeScreen />);
      expect(screen.getByTestId('welcome-back-card')).toBeTruthy();
      expect(screen.queryByTestId('backup-nudge-card')).toBeNull();
    });
  });
});

describe('HomeScreen — customizable layout (Step 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountServableDueItems.mockReturnValue(2);
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
    mockLastBackedUpAt = null;
    mockHomeLayoutStored = null;
    setPlatform('ios');
    mockOnVacation = false;
    mockVacationReadThrows = false;
    mockLoadPercent = 42;
    mockIsOvershoot = false;
    mockSeenGuidanceCards.clear();
    clearReviewPriority();
  });

  it('renders a stored non-default order in that order', () => {
    mockAtRisk = {
      totalCount: 3,
      topItems: [
        { itemId: '5', primaryForm: '食べる', meaning: 'to eat', itemType: 'vocabulary' },
      ],
      allItems: [
        { itemId: '5', primaryForm: '食べる', meaning: 'to eat', itemType: 'vocabulary' },
      ],
      rankedItemIds: ['5'],
    };
    mockReadingTarget = {
      passageId: '7',
      title: '自己紹介',
      itemsRemainingToUnlock: 4,
      coverage: 0.55,
      noProgressYet: false,
    };
    mockHomeLayoutStored = serializeHomeLayout([
      { id: 'at-risk', visible: true },
      { id: 'review-cta', visible: true },
      { id: 'lesson-cta', visible: true },
      { id: 'reading-readiness', visible: true },
      { id: 'level-progress', visible: true },
      { id: 'review-forecast', visible: true },
      { id: 'goal-ring', visible: true },
    ]);

    render(<HomeScreen />);

    const markers = [
      'at-risk-section',
      'home-review-button',
      'home-learn-button',
      'reading-readiness',
      'N5 Progress',
      'review-forecast',
      'Goal 42 percent',
    ];
    const dump = JSON.stringify(screen.toJSON());
    const positions = markers.map((marker) => dump.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('omits a section the stored layout marks hidden', () => {
    mockHomeLayoutStored = serializeHomeLayout([
      { id: 'goal-ring', visible: true },
      { id: 'review-cta', visible: true },
      { id: 'lesson-cta', visible: true },
      { id: 'level-progress', visible: true },
      { id: 'review-forecast', visible: false },
      { id: 'reading-readiness', visible: true },
      { id: 'at-risk', visible: true },
    ]);

    render(<HomeScreen />);

    expect(screen.queryByTestId('review-forecast')).toBeNull();
    // The rest of the default layout is unaffected by hiding one section.
    expect(screen.getByTestId('home-review-button')).toBeTruthy();
    expect(screen.getByLabelText('Goal 42 percent')).toBeTruthy();
  });

  it('still renders the required CTAs even when the stored layout drops them', () => {
    // Simulates a corrupted or hand-edited stored value that omits the two
    // required sections entirely — the reconciler must restore them.
    mockHomeLayoutStored = serializeHomeLayout([{ id: 'at-risk', visible: true }]);

    render(<HomeScreen />);

    expect(screen.getByTestId('home-review-button')).toBeTruthy();
    expect(screen.getByTestId('home-learn-button')).toBeTruthy();
  });
});
