import { render, screen } from '@testing-library/react-native';

import HomeScreen from './index';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {} }),
}));

jest.mock('@/data/hooks/useCognitiveLoad', () => ({
  useCognitiveLoad: () => ({
    percent: 42,
    isLoading: false,
    refetch: jest.fn(),
  }),
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
  });

  it('renders cognitive load ring, Review and Learn buttons, streak, and progress bar', () => {
    mockGetDueSrsStates.mockReturnValue([{ itemId: '1' }, { itemId: '2' }]);
    render(<HomeScreen />);

    expect(screen.getByLabelText('Cognitive load 42 percent')).toBeTruthy();
    expect(screen.getByRole('button', { name: /start today's lesson/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /review 2 items due/i })).toBeTruthy();
    expect(screen.getByTestId('home-streak-counter')).toBeTruthy();
    expect(screen.getByText('N5 Progress')).toBeTruthy();
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
