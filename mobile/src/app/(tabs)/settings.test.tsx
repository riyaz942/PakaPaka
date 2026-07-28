import { fireEvent, render, screen } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import SettingsScreen from './settings';

const mockSetReducedMotion = jest.fn();
const mockSetThemeMode = jest.fn();
let mockStoredThemeMode: 'system' | 'light' | 'dark' = 'system';
const mockSetAutoAdvanceEnabled = jest.fn();
let mockAutoAdvanceEnabled = false;
const mockEnableShadowMode = jest.fn();
const mockDisableShadowMode = jest.fn();
const mockSetFuriganaMode = jest.fn();
const mockClearOneOverride = jest.fn();
const mockClearAllOverrides = jest.fn();
let mockOverrideEntries: { itemId: string; primaryForm: string; mode: 'shown' | 'hidden' }[] = [];

let mockShadowModeCanEnable = false;
let mockShadowModeEnabled = false;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUserDb = {};

jest.mock('@/data/hooks/useDatabase', () => ({
  // Stable reference: a fresh object per render would re-run [userDb] effects
  // on every render and reset screen state mid-test.
  useDatabase: () => ({ userDb: mockUserDb }),
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({
    reducedMotion: false,
    preference: null,
    setReducedMotion: mockSetReducedMotion,
  }),
}));

jest.mock('@/data/hooks/useReviewAutoAdvance', () => ({
  useReviewAutoAdvance: () => ({
    autoAdvanceEnabled: mockAutoAdvanceEnabled,
    setAutoAdvanceEnabled: mockSetAutoAdvanceEnabled,
  }),
}));

jest.mock('@/data/hooks/useShadowMode', () => ({
  useShadowMode: () => ({
    canEnable: mockShadowModeCanEnable,
    isEnabled: mockShadowModeEnabled,
    enable: mockEnableShadowMode,
    disable: mockDisableShadowMode,
  }),
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'auto',
    setMode: mockSetFuriganaMode,
    knownKanji: new Set(),
    refreshKnownKanji: jest.fn(),
    overrides: new Map(),
    modeForItem: () => 'auto',
    setOverride: jest.fn(),
    clearOverride: jest.fn(),
    clearAllOverrides: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useFuriganaOverrideList', () => ({
  useFuriganaOverrideList: () => ({
    entries: mockOverrideEntries,
    clearOne: mockClearOneOverride,
    clearAll: mockClearAllOverrides,
  }),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getSessionIntensity: () => 'standard',
  getWeaknessBiasEnabled: () => true,
  getNotificationsEnabled: () => false,
  getNotificationTime: () => 'evening',
  setSessionIntensity: jest.fn(),
  setWeaknessBiasEnabled: jest.fn(),
  setNotificationsEnabled: jest.fn(),
  setNotificationTime: jest.fn(),
  clearOnboardingCompleted: jest.fn(),
  NOTIFICATION_TIME_HOURS: { evening: 19 },
  // BYOK section (Story 5.1) — the fake `userDb` has no query methods, so the
  // AI preference reads are stubbed alongside the rest of this module.
  getAiActiveProvider: () => null,
  getAiModel: () => null,
  getAiOpenAiBaseUrl: () => null,
  setAiActiveProvider: jest.fn(),
  setAiModel: jest.fn(),
  setAiOpenAiBaseUrl: jest.fn(),
  // Cloud STT opt-in (Story 5.2) — same reason as the AI reads above.
  getCloudSttOptIn: () => false,
  getWordTranslateOptIn: () => false,
  setWordTranslateOptIn: jest.fn(),
  setCloudSttOptIn: jest.fn(),
  // Appearance section — same reason as the AI reads above.
  getThemeMode: () => mockStoredThemeMode,
  // Indirected like setDailyGoalTarget below: the factory runs at import time,
  // before the module-scope mock consts are initialised.
  setThemeMode: (db: unknown, mode: string) => mockSetThemeMode(db, mode),
}));

jest.mock('@/config/notifications', () => ({
  requestNotificationPermission: jest.fn(),
  scheduleReviewReminder: jest.fn(),
  cancelAllNotifications: jest.fn(),
}));

let mockDailyGoalTarget = 30;
const mockSetDailyGoalTarget = jest.fn((_db: unknown, target: number) => {
  mockDailyGoalTarget = target;
  return { ok: true as const, value: undefined };
});

jest.mock('@/data/user/goalRingRepository', () => ({
  resolveDailyGoalTarget: () => mockDailyGoalTarget,
  setDailyGoalTarget: (db: unknown, target: number) => mockSetDailyGoalTarget(db, target),
}));

describe('SettingsScreen daily goal (Story 2.1, FR57 / UX-DR33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDailyGoalTarget = 30;
  });

  it('shows the current goal in an unbounded numeric field', () => {
    render(<SettingsScreen />);
    const input = screen.getByTestId('settings-daily-goal-input');
    expect(input.props.value).toBe('30');
  });

  it('persists an unbounded goal above the legacy maximum and reads it back', () => {
    render(<SettingsScreen />);
    const input = screen.getByTestId('settings-daily-goal-input');
    fireEvent.changeText(input, '200');
    fireEvent(screen.getByTestId('settings-daily-goal-input'), 'blur');
    expect(mockSetDailyGoalTarget).toHaveBeenCalledWith(expect.anything(), 200);
    expect(screen.getByTestId('settings-daily-goal-input').props.value).toBe('200');
  });

  it('rejects a non-positive goal with an inline error and no write', () => {
    render(<SettingsScreen />);
    const input = screen.getByTestId('settings-daily-goal-input');
    fireEvent.changeText(input, '0');
    fireEvent(screen.getByTestId('settings-daily-goal-input'), 'blur');
    expect(mockSetDailyGoalTarget).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a number greater than zero.')).toBeTruthy();
  });
});

describe('SettingsScreen accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShadowModeCanEnable = false;
    mockShadowModeEnabled = false;
  });

  it('renders the Reduce motion switch with accessibilityLabel', () => {
    render(<SettingsScreen />);
    const toggle = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(toggle).toBeTruthy();
    expect(toggle.props.value).toBe(false);
    expect(screen.getByTestId('settings-reduced-motion-toggle')).toBeTruthy();
  });

  it('persists reduced motion when toggled', () => {
    render(<SettingsScreen />);
    fireEvent(screen.getByTestId('settings-reduced-motion-toggle'), 'valueChange', true);
    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });
});

describe('SettingsScreen review auto-advance toggle (Story 1.2, FR84 / UX-DR10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoAdvanceEnabled = false;
  });

  it('renders the auto-advance switch off by default', () => {
    render(<SettingsScreen />);
    const toggle = screen.getByRole('switch', { name: 'Auto-advance after correct answers' });
    expect(toggle).toBeTruthy();
    expect(toggle.props.value).toBe(false);
  });

  it('labels the setting as Lightning Mode in the description', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/Lightning Mode/)).toBeTruthy();
  });

  it('persists the preference when toggled on', () => {
    render(<SettingsScreen />);
    fireEvent(screen.getByTestId('settings-review-auto-advance-toggle'), 'valueChange', true);
    expect(mockSetAutoAdvanceEnabled).toHaveBeenCalledWith(true);
  });

  it('reflects a stored ON preference', () => {
    mockAutoAdvanceEnabled = true;
    render(<SettingsScreen />);
    const toggle = screen.getByTestId('settings-review-auto-advance-toggle');
    expect(toggle.props.value).toBe(true);
  });
});

describe('SettingsScreen shadow mode toggle (AC1/AC2/AC3 gating)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShadowModeCanEnable = false;
    mockShadowModeEnabled = false;
  });

  it('does not render the Shadow mode toggle when canEnable is false (feature off or no import)', () => {
    render(<SettingsScreen />);
    expect(screen.queryByTestId('settings-shadow-mode-toggle')).toBeNull();
    expect(screen.queryByText('Shadow mode')).toBeNull();
  });

  it('renders the Shadow mode toggle when canEnable is true', () => {
    mockShadowModeCanEnable = true;
    render(<SettingsScreen />);

    const toggle = screen.getByRole('switch', { name: 'Shadow mode' });
    expect(toggle).toBeTruthy();
    expect(screen.getByTestId('settings-shadow-mode-toggle')).toBeTruthy();
  });

  it('calls enable() when toggled on', () => {
    mockShadowModeCanEnable = true;
    mockShadowModeEnabled = false;
    render(<SettingsScreen />);

    fireEvent(screen.getByTestId('settings-shadow-mode-toggle'), 'valueChange', true);
    expect(mockEnableShadowMode).toHaveBeenCalledTimes(1);
    expect(mockDisableShadowMode).not.toHaveBeenCalled();
  });

  it('calls disable() when toggled off', () => {
    mockShadowModeCanEnable = true;
    mockShadowModeEnabled = true;
    render(<SettingsScreen />);

    fireEvent(screen.getByTestId('settings-shadow-mode-toggle'), 'valueChange', false);
    expect(mockDisableShadowMode).toHaveBeenCalledTimes(1);
    expect(mockEnableShadowMode).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen — per-word furigana overrides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverrideEntries = [];
  });

  it('omits the overrides list entirely when nothing is overridden', () => {
    // Same empty-state policy as CrossReferenceSection: no empty shells.
    render(<SettingsScreen />);
    expect(screen.queryByTestId('settings-furigana-overrides')).toBeNull();
    expect(screen.queryByTestId('settings-furigana-overrides-reset')).toBeNull();
  });

  it('lists each overridden word with its mode', () => {
    mockOverrideEntries = [
      { itemId: 'vocab-1', primaryForm: '食べる', mode: 'hidden' },
      { itemId: 'vocab-2', primaryForm: '学校', mode: 'shown' },
    ];
    render(<SettingsScreen />);

    expect(screen.getByTestId('settings-furigana-overrides')).toBeTruthy();
    expect(screen.getByText('食べる')).toBeTruthy();
    expect(screen.getByText('学校')).toBeTruthy();
    // Distinct from the global picker's "Always hidden"/"Always shown" labels,
    // which are on screen at the same time.
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByText('Shown')).toBeTruthy();
  });

  it('resets a single word', () => {
    mockOverrideEntries = [{ itemId: 'vocab-1', primaryForm: '食べる', mode: 'hidden' }];
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-furigana-override-reset-vocab-1'));
    expect(mockClearOneOverride).toHaveBeenCalledWith('vocab-1');
  });

  it('resets every override at once', () => {
    mockOverrideEntries = [
      { itemId: 'vocab-1', primaryForm: '食べる', mode: 'hidden' },
      { itemId: 'vocab-2', primaryForm: '学校', mode: 'shown' },
    ];
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-furigana-overrides-reset'));
    expect(mockClearAllOverrides).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen appearance (light/dark palette)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoredThemeMode = 'system';
  });

  it('offers System, Light and Dark, defaulting to System', () => {
    render(<SettingsScreen />);

    for (const mode of ['system', 'light', 'dark']) {
      expect(screen.getByTestId(`settings-theme-mode-${mode}`)).toBeTruthy();
    }
    expect(
      screen.getByTestId('settings-theme-mode-system').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('persists the chosen mode and applies it to the app appearance', () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-theme-mode-dark'));

    expect(mockSetThemeMode).toHaveBeenCalledWith(mockUserDb, 'dark');
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
  });

  it('reflects a stored preference and maps System to the device setting', () => {
    const setColorScheme = jest.spyOn(Appearance, 'setColorScheme');
    mockStoredThemeMode = 'light';
    render(<SettingsScreen />);

    expect(screen.getByTestId('settings-theme-mode-light').props.accessibilityState.selected).toBe(
      true,
    );
    expect(setColorScheme).toHaveBeenLastCalledWith('light');

    fireEvent.press(screen.getByTestId('settings-theme-mode-system'));
    expect(mockSetThemeMode).toHaveBeenCalledWith(mockUserDb, 'system');
    expect(setColorScheme).toHaveBeenLastCalledWith('unspecified');
  });
});
