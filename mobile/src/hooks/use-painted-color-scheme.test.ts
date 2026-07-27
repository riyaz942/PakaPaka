import { renderHook } from '@testing-library/react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

jest.mock('nativewind', () => ({ useColorScheme: jest.fn() }));

// Proxy rather than spread: react-native's index exports lazy getters, and
// eagerly reading them all inside a mock factory blows up on require cycles.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const useColorScheme = jest.fn();

  return new Proxy(actual, {
    get: (target, prop) => (prop === 'useColorScheme' ? useColorScheme : target[prop]),
  });
});

const mockNativeWind = useNativeWindColorScheme as jest.Mock;
const mockDevice = useDeviceColorScheme as jest.Mock;

describe('usePaintedColorScheme', () => {
  it('follows the NativeWind scheme that paints the surfaces', () => {
    mockNativeWind.mockReturnValue({ colorScheme: 'light' });
    mockDevice.mockReturnValue('dark');

    expect(renderHook(() => usePaintedColorScheme()).result.current).toBe('light');
  });

  it('falls back light-first when RN reports null (plan 12.1 white-on-white)', () => {
    mockNativeWind.mockReturnValue({ colorScheme: undefined });
    mockDevice.mockReturnValue(null);

    expect(renderHook(() => usePaintedColorScheme()).result.current).toBe('light');
  });

  it('falls back to the device scheme when it is explicitly dark', () => {
    mockNativeWind.mockReturnValue({ colorScheme: undefined });
    mockDevice.mockReturnValue('dark');

    expect(renderHook(() => usePaintedColorScheme()).result.current).toBe('dark');
  });
});
