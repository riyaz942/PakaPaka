import { renderHook } from '@testing-library/react-native';
import { Appearance, Platform } from 'react-native';

import { useThemeMode } from '@/data/hooks/useThemeMode';

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: {} }),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getThemeMode: () => 'dark',
  setThemeMode: jest.fn(),
}));

function setPlatform(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('useThemeMode', () => {
  const original = Appearance.setColorScheme;

  afterEach(() => {
    setPlatform('ios');
    Appearance.setColorScheme = original;
  });

  it('applies the stored mode through Appearance on native', () => {
    const spy = jest.fn();
    Appearance.setColorScheme = spy;
    renderHook(() => useThemeMode());
    expect(spy).toHaveBeenCalledWith('dark');
  });

  it('does not call Appearance.setColorScheme on web (react-native-web has none)', () => {
    setPlatform('web');
    (Appearance as { setColorScheme?: unknown }).setColorScheme = undefined;
    expect(() => renderHook(() => useThemeMode())).not.toThrow();
  });
});
