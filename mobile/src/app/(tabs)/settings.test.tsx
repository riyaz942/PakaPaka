import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Appearance } from 'react-native';

import { GUIDANCE_CARDS } from '@/components/onboarding/cardRegistry';
import { cancelAllNotifications, scheduleReviewReminder } from '@/config/notifications';

import SettingsScreen from './settings';

const mockSetReducedMotion = jest.fn();
const mockSetThemeMode = jest.fn();
let mockStoredThemeMode: 'system' | 'light' | 'dark' = 'system';
const mockSetAutoAdvanceEnabled = jest.fn();
let mockAutoAdvanceEnabled = false;
const mockEnableShadowMode = jest.fn();
const mockDisableShadowMode = jest.fn();
const mockRefetchReducedMotion = jest.fn();
const mockRefetchAutoAdvance = jest.fn();
const mockRefetchVacation = jest.fn();
const mockRefetchShadowMode = jest.fn();
const mockSetFuriganaMode = jest.fn();
const mockClearOneOverride = jest.fn();
const mockClearAllOverrides = jest.fn();
let mockOverrideEntries: { itemId: string; primaryForm: string; mode: 'shown' | 'hidden' }[] = [];

let mockShadowModeCanEnable = false;
let mockShadowModeEnabled = false;

let mockVacationActive = false;
let mockVacationStartedAt: string | null = null;
const mockStartVacation = jest.fn();
const mockEndVacation = jest.fn(() => ({
  ok: true as const,
  value: { shiftedCount: 12, days: 10 },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUserDb = {};

jest.mock('@/data/hooks/useDatabase', () => ({
  // Stable reference: a fresh object per render would re-run [userDb] effects
  // on every render and reset screen state mid-test.
  useDatabase: () => ({ userDb: mockUserDb }),
}));

/** In-memory stand-in for the `card_seen` table (Epic 7). */
const mockSeenGuidanceCards = new Set<string>();

jest.mock('@/data/user/cardSeenRepository', () => ({
  isCardSeen: (_userDb: unknown, cardId: string) => mockSeenGuidanceCards.has(cardId),
  markCardSeen: (_userDb: unknown, cardId: string) => {
    mockSeenGuidanceCards.add(cardId);
  },
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({
    reducedMotion: false,
    preference: null,
    setReducedMotion: mockSetReducedMotion,
    refetch: mockRefetchReducedMotion,
  }),
}));

jest.mock('@/data/hooks/useReviewAutoAdvance', () => ({
  useReviewAutoAdvance: () => ({
    autoAdvanceEnabled: mockAutoAdvanceEnabled,
    setAutoAdvanceEnabled: mockSetAutoAdvanceEnabled,
    refetch: mockRefetchAutoAdvance,
  }),
}));

jest.mock('@/data/hooks/useVacationMode', () => ({
  useVacationMode: () => ({
    isVacationActive: mockVacationActive,
    startedAt: mockVacationStartedAt,
    start: mockStartVacation,
    end: mockEndVacation,
    refetch: mockRefetchVacation,
  }),
}));

jest.mock('@/data/hooks/useShadowMode', () => ({
  useShadowMode: () => ({
    canEnable: mockShadowModeCanEnable,
    isEnabled: mockShadowModeEnabled,
    enable: mockEnableShadowMode,
    disable: mockDisableShadowMode,
    refetch: mockRefetchShadowMode,
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
  // Backup section (Story 9.2) — the "last backed up" indicator and the reads
  // the screen re-runs after a restore replaces user.db.
  getLastBackedUpAt: () => mockLastBackedUpAt,
  getFuriganaDisplay: () => 'auto',
}));

const mockExportBackup = jest.fn();

jest.mock('@/data/user/exportBackup', () => ({
  exportBackup: (db: unknown, options: unknown) => mockExportBackup(db, options),
}));

let mockLastBackedUpAt: string | null = null;

const mockPreviewRestore = jest.fn();
const mockRestoreBackup = jest.fn();

jest.mock('@/data/user/restoreBackup', () => ({
  previewRestore: (db: unknown, uri: string) => mockPreviewRestore(db, uri),
  restoreBackup: (db: unknown, preview: unknown, origin: string) =>
    mockRestoreBackup(db, preview, origin),
}));

const mockGetDocumentAsync = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (options: unknown) => mockGetDocumentAsync(options),
}));

const mockShareAsync = jest.fn();
const mockIsSharingAvailableAsync = jest.fn(() => Promise.resolve(true));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsSharingAvailableAsync(),
  shareAsync: (uri: string, options: unknown) => mockShareAsync(uri, options),
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

  it('shows the current goal in the stepper', () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-daily-goal-value')).toHaveTextContent('30');
  });

  it('persists a raised goal and reads it back', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-daily-goal-increment'));
    expect(mockSetDailyGoalTarget).toHaveBeenCalledWith(expect.anything(), 35);
    expect(screen.getByTestId('settings-daily-goal-value')).toHaveTextContent('35');
  });

  it('has no upper bound — the increment never disables', () => {
    mockDailyGoalTarget = 200;
    render(<SettingsScreen />);
    expect(
      screen.getByTestId('settings-daily-goal-increment').props.accessibilityState.disabled,
    ).toBe(false);
  });

  it('cannot step below one load unit step, so no non-positive goal is ever written', () => {
    mockDailyGoalTarget = 5;
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-daily-goal-decrement'));
    expect(mockSetDailyGoalTarget).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-daily-goal-value')).toHaveTextContent('5');
  });
});

describe('SettingsScreen vacation mode toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVacationActive = false;
    mockVacationStartedAt = null;
  });

  it('renders the switch off by default', () => {
    render(<SettingsScreen />);
    const toggle = screen.getByRole('switch', { name: 'Pause reviews and lessons' });
    expect(toggle.props.accessibilityState.checked).toBe(false);
  });

  it('starts vacation mode when toggled on', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-vacation-mode-toggle'));
    expect(mockStartVacation).toHaveBeenCalled();
    expect(mockEndVacation).not.toHaveBeenCalled();
  });

  it('shows when the break began while paused', () => {
    mockVacationActive = true;
    mockVacationStartedAt = '2026-07-01T09:00:00.000Z';
    render(<SettingsScreen />);
    expect(
      screen.getByTestId('settings-vacation-mode-toggle').props.accessibilityState.checked,
    ).toBe(true);
    expect(screen.getByText(/Paused since/)).toBeTruthy();
  });

  it('reports how many reviews were rescheduled on resume', () => {
    mockVacationActive = true;
    mockVacationStartedAt = '2026-07-01T09:00:00.000Z';
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-vacation-mode-toggle'));
    expect(mockEndVacation).toHaveBeenCalled();
    expect(screen.getByTestId('settings-vacation-result')).toHaveTextContent(
      'Welcome back — 12 reviews rescheduled.',
    );
  });

  it('surfaces the error message when resuming fails', () => {
    mockVacationActive = true;
    mockVacationStartedAt = '2026-07-01T09:00:00.000Z';
    mockEndVacation.mockReturnValueOnce({
      ok: false,
      error: {
        code: 'vacation_resume_failed',
        message: 'boom',
        userMessage: 'Vacation mode could not be turned off. Please try again.',
      },
    } as unknown as ReturnType<typeof mockEndVacation>);
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-vacation-mode-toggle'));
    expect(screen.getByTestId('settings-vacation-result')).toHaveTextContent(
      'Vacation mode could not be turned off. Please try again.',
    );
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
    expect(toggle.props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('settings-reduced-motion-toggle')).toBeTruthy();
  });

  it('persists reduced motion when toggled', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-reduced-motion-toggle'));
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
    expect(toggle.props.accessibilityState.checked).toBe(false);
  });

  it('labels the setting as Lightning Mode in the description', () => {
    render(<SettingsScreen />);
    expect(screen.getByText(/Lightning Mode/)).toBeTruthy();
  });

  it('persists the preference when toggled on', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-review-auto-advance-toggle'));
    expect(mockSetAutoAdvanceEnabled).toHaveBeenCalledWith(true);
  });

  it('reflects a stored ON preference', () => {
    mockAutoAdvanceEnabled = true;
    render(<SettingsScreen />);
    const toggle = screen.getByTestId('settings-review-auto-advance-toggle');
    expect(toggle.props.accessibilityState.checked).toBe(true);
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

    fireEvent.press(screen.getByTestId('settings-shadow-mode-toggle'));
    expect(mockEnableShadowMode).toHaveBeenCalledTimes(1);
    expect(mockDisableShadowMode).not.toHaveBeenCalled();
  });

  it('calls disable() when toggled off', () => {
    mockShadowModeCanEnable = true;
    mockShadowModeEnabled = true;
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-shadow-mode-toggle'));
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

describe('SettingsScreen — "How this works" library (Epic 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeenGuidanceCards.clear();
  });

  it('lists every registry card, deck cards included, in registry order', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('How this works')).toBeTruthy();

    const rows = GUIDANCE_CARDS.map((card) =>
      screen.getByTestId(`settings-guidance-card-${card.id}`),
    );
    expect(rows).toHaveLength(GUIDANCE_CARDS.length);

    for (const card of GUIDANCE_CARDS) {
      const row = screen.getByTestId(`settings-guidance-card-${card.id}`);
      expect(row.props.accessibilityLabel).toBe(`Explain: ${card.title}`);
      expect(row.props.accessibilityRole).toBe('button');
      expect(row.props.className).toContain('min-h-[44px]');
    }
  });

  it('opens a card in the shared sheet, whatever its trigger', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-guidance-card-first-miss'));
    expect(screen.getByTestId('explainer-sheet')).toBeTruthy();
    expect(screen.getByText(/not a strike against you/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('explainer-sheet-close'));
    expect(screen.queryByText(/not a strike against you/)).toBeNull();
  });

  it('reads the library-only card that never fires on its own', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-guidance-card-two-card-kanji'));
    expect(screen.getByText(/becomes two review cards/)).toBeTruthy();
  });

  it('never consumes the just-in-time moment — reading here writes no seen flag', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId('settings-guidance-card-passage-locks'));
    expect(screen.getByText(/at least 90% of the vocabulary and grammar/)).toBeTruthy();

    expect(mockSeenGuidanceCards.has('passage-locks')).toBe(false);
    expect(mockSeenGuidanceCards.size).toBe(0);
  });
});

describe('SettingsScreen backup export (Story 9.1, AC3/AC4/AC6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSharingAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it('defaults the AI conversations toggle to off', () => {
    render(<SettingsScreen />);
    const toggle = screen.getByRole('switch', { name: 'Include AI conversations' });
    expect(toggle.props.accessibilityState.checked).toBe(false);
  });

  it('exports with conversations excluded by default and hands the file to the share sheet', async () => {
    mockExportBackup.mockResolvedValue({
      ok: true,
      value: {
        fileUri: 'file:///mock-documents/kizamu-backup-2026-08-13T00-00-00-000Z.json.gz',
        itemCount: 42,
        byteSize: 2048,
        omittedCount: 0,
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(mockExportBackup).toHaveBeenCalledWith(mockUserDb, { includeConversations: false });
    });

    await waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalledWith(
        'file:///mock-documents/kizamu-backup-2026-08-13T00-00-00-000Z.json.gz',
        expect.objectContaining({ mimeType: 'application/gzip' }),
      );
    });

    expect(screen.getByTestId('settings-backup-result')).toHaveTextContent(
      'Exported 42 rows · 2.0 KB',
    );
  });

  it('passes includeConversations through when the toggle is on', async () => {
    mockExportBackup.mockResolvedValue({
      ok: true,
      value: {
        fileUri: 'file:///mock-documents/kizamu-backup-2026-08-13T00-00-00-000Z.json.gz',
        itemCount: 5,
        byteSize: 512,
        omittedCount: 0,
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-include-conversations-toggle'));
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(mockExportBackup).toHaveBeenCalledWith(mockUserDb, { includeConversations: true });
    });
  });

  it('surfaces the error message and skips the share sheet when export fails', async () => {
    mockExportBackup.mockResolvedValue({
      ok: false,
      error: { code: 'BACKUP_EXPORT_FAILED', message: 'boom', userMessage: 'Could not export your backup.' },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-error')).toHaveTextContent(
        'Could not export your backup.',
      );
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('shows how many orphaned items were skipped', async () => {
    mockExportBackup.mockResolvedValue({
      ok: true,
      value: {
        fileUri: 'file:///mock-documents/kizamu-backup-2026-08-13T00-00-00-000Z.json.gz',
        itemCount: 10,
        byteSize: 1024,
        omittedCount: 2,
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-omitted')).toHaveTextContent(
        '2 items were skipped — no longer in the curriculum.',
      );
    });
  });

  it('keeps the export result and shows an error when sharing is unavailable', async () => {
    mockIsSharingAvailableAsync.mockResolvedValue(false);
    mockExportBackup.mockResolvedValue({
      ok: true,
      value: {
        fileUri: 'file:///mock-documents/kizamu-backup-2026-08-13T00-00-00-000Z.json.gz',
        itemCount: 3,
        byteSize: 256,
        omittedCount: 0,
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-result')).toHaveTextContent(
        'Exported 3 rows · 256 B',
      );
      expect(screen.getByTestId('settings-backup-error')).toHaveTextContent(/Sharing is unavailable/);
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('keeps the export result and shows an error when the share sheet throws', async () => {
    mockShareAsync.mockRejectedValue(new Error('share cancelled badly'));
    mockExportBackup.mockResolvedValue({
      ok: true,
      value: {
        fileUri: 'file:///mock-documents/kizamu-backup-2026-08-13T00-00-00-000Z.json.gz',
        itemCount: 3,
        byteSize: 256,
        omittedCount: 0,
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-result')).toHaveTextContent(
        'Exported 3 rows · 256 B',
      );
      expect(screen.getByTestId('settings-backup-error')).toHaveTextContent(
        'Could not open the share sheet.',
      );
    });
  });
});

describe('SettingsScreen backup nudge and restore (Story 9.2, AC1/AC2/AC3/AC6)', () => {
  const PREVIEW = {
    bundle: { exportedAt: '2026-08-10T00:00:00.000Z' },
    unmatchedSlugs: [],
    summary: {
      itemCount: 12,
      unmatchedSlugCount: 0,
      unmatchedPassageCount: 0,
      includesConversations: false,
      exportedAt: '2026-08-10T00:00:00.000Z',
      curriculumVersion: '1.4.0',
      schemaVersion: 19,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLastBackedUpAt = null;
    mockIsSharingAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it('says never backed up when no export has run', () => {
    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-backup-last-backed-up')).toHaveTextContent(
      'Never backed up',
    );
  });

  it('shows how long ago the last backup was', () => {
    mockLastBackedUpAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-backup-last-backed-up')).toHaveTextContent(
      'Last backed up 3 days ago',
    );
  });

  it('clears the never-backed-up state after a successful export', async () => {
    mockExportBackup.mockImplementation(() => {
      mockLastBackedUpAt = new Date().toISOString();
      return Promise.resolve({
        ok: true,
        value: { fileUri: 'file:///backup.json.gz', itemCount: 3, byteSize: 256, omittedCount: 0 },
      });
    });

    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-backup-last-backed-up')).toHaveTextContent(
      'Never backed up',
    );
    fireEvent.press(screen.getByTestId('settings-backup-export-button'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-last-backed-up')).toHaveTextContent(
        'Last backed up today',
      );
    });
  });

  it('asks the picker for a wide set of types so .json.gz is selectable', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));

    await waitFor(() => {
      expect(mockGetDocumentAsync).toHaveBeenCalledWith(
        expect.objectContaining({ copyToCacheDirectory: true }),
      );
    });
    const options = mockGetDocumentAsync.mock.calls[0][0] as { type: string[] };
    expect(options.type).toEqual(expect.arrayContaining(['application/gzip', '*/*']));
  });

  it('treats a cancelled picker as a no-op', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));

    await waitFor(() => {
      expect(mockGetDocumentAsync).toHaveBeenCalled();
    });
    expect(mockPreviewRestore).not.toHaveBeenCalled();
    expect(screen.queryByTestId('restore-preview-card')).toBeNull();
  });

  it('shows the preview inline and only restores after confirmation', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/kizamu-backup.json.gz', name: 'kizamu-backup.json.gz' }],
    });
    mockPreviewRestore.mockResolvedValue({ ok: true, value: PREVIEW });
    mockRestoreBackup.mockReturnValue({
      ok: true,
      value: { restoredRowCount: 12, unmatchedSlugCount: 0, unmatchedPassageCount: 0 },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));

    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-item-count')).toHaveTextContent(/12 rows/);
    });
    expect(screen.getByTestId('restore-preview-warning')).toHaveTextContent(
      'This replaces your current progress on this device.',
    );
    expect(screen.getByTestId('restore-preview-all-matched')).toBeTruthy();
    // Nothing written until confirm (AC1).
    expect(mockRestoreBackup).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('restore-preview-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-restore-result')).toHaveTextContent(
        'Restored 12 rows.',
      );
    });
    expect(mockRestoreBackup).toHaveBeenCalledWith(expect.anything(), PREVIEW, 'settings');
    expect(screen.queryByTestId('restore-preview-card')).toBeNull();
    expect(mockRefetchVacation).toHaveBeenCalled();
    expect(mockRefetchAutoAdvance).toHaveBeenCalled();
    expect(mockRefetchReducedMotion).toHaveBeenCalled();
    expect(mockRefetchShadowMode).toHaveBeenCalled();
    expect(cancelAllNotifications).toHaveBeenCalled();
    expect(scheduleReviewReminder).not.toHaveBeenCalled();
  });

  it('reports skipped slugs in the restore result', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/kizamu-backup.json.gz' }],
    });
    mockPreviewRestore.mockResolvedValue({
      ok: true,
      value: { ...PREVIEW, unmatchedSlugs: ['kanji:gone'], summary: { ...PREVIEW.summary, unmatchedSlugCount: 1 } },
    });
    mockRestoreBackup.mockReturnValue({
      ok: true,
      value: { restoredRowCount: 12, unmatchedSlugCount: 1, unmatchedPassageCount: 0 },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));

    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-unmatched-list')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('restore-preview-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-backup-restore-result')).toHaveTextContent(
        /1 skipped \(no longer in the curriculum\)/,
      );
    });
  });

  it('surfaces a corrupt-file error without offering to restore', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/notes.txt' }],
    });
    mockPreviewRestore.mockResolvedValue({
      ok: false,
      error: {
        code: 'BACKUP_INVALID_GZIP',
        message: 'incorrect header check',
        userMessage: 'That file is not a Kizamu backup. Pick the .json.gz file you exported.',
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));

    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-error')).toHaveTextContent(
        /That file is not a Kizamu backup/,
      );
    });
    expect(screen.queryByTestId('restore-preview-confirm')).toBeNull();
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  it('says previous progress was not changed when the restore write fails', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/kizamu-backup.json.gz' }],
    });
    mockPreviewRestore.mockResolvedValue({ ok: true, value: PREVIEW });
    mockRestoreBackup.mockReturnValue({
      ok: false,
      error: {
        code: 'BACKUP_RESTORE_FAILED',
        message: 'disk full',
        userMessage: 'Restore could not be saved. Your previous progress was not changed.',
      },
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));
    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-confirm')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('restore-preview-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-error')).toHaveTextContent(
        /Your previous progress was not changed/,
      );
    });
    expect(screen.queryByTestId('settings-backup-restore-result')).toBeNull();
  });

  it('re-reads the restored theme so the screen does not keep pre-restore state', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/kizamu-backup.json.gz' }],
    });
    mockPreviewRestore.mockResolvedValue({ ok: true, value: PREVIEW });
    mockRestoreBackup.mockImplementation(() => {
      mockStoredThemeMode = 'dark';
      return {
        ok: true,
        value: { restoredRowCount: 12, unmatchedSlugCount: 0, unmatchedPassageCount: 0 },
      };
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));
    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-confirm')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('restore-preview-confirm'));

    await waitFor(() => {
      expect(mockSetThemeMode).toHaveBeenCalledWith(expect.anything(), 'dark');
    });
    expect(mockSetFuriganaMode).toHaveBeenCalledWith('auto');

    mockStoredThemeMode = 'system';
  });

  it('cancelling the preview leaves everything untouched', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/kizamu-backup.json.gz' }],
    });
    mockPreviewRestore.mockResolvedValue({ ok: true, value: PREVIEW });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-backup-restore-button'));
    await waitFor(() => {
      expect(screen.getByTestId('restore-preview-cancel')).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId('restore-preview-cancel'));

    expect(screen.queryByTestId('restore-preview-card')).toBeNull();
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });
});
