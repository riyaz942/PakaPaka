import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from './settings';

const mockSetReducedMotion = jest.fn();

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
