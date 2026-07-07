import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from './settings';

const mockSetReducedMotion = jest.fn();
const mockEnableShadowMode = jest.fn();
const mockDisableShadowMode = jest.fn();
const mockSetFuriganaMode = jest.fn();

let mockShadowModeCanEnable = false;
let mockShadowModeEnabled = false;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {} }),
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({
    reducedMotion: false,
    preference: null,
    setReducedMotion: mockSetReducedMotion,
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
}));

jest.mock('@/config/notifications', () => ({
  requestNotificationPermission: jest.fn(),
  scheduleStreakReminder: jest.fn(),
  cancelAllNotifications: jest.fn(),
}));

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
