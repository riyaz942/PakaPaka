import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useSheetFrame, useWideLayout } from './useWideLayout';

const mockWindow = { width: 390 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 1, fontScale: 1 }),
}));

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('useWideLayout', () => {
  afterEach(() => setPlatform('ios'));

  it('is true on web at desktop width', () => {
    setPlatform('web');
    mockWindow.width = 1024;
    expect(renderHook(() => useWideLayout()).result.current).toBe(true);
  });

  it('is false on web below desktop width', () => {
    setPlatform('web');
    mockWindow.width = 1023;
    expect(renderHook(() => useWideLayout()).result.current).toBe(false);
  });

  it('is false on native at any width', () => {
    setPlatform('ios');
    mockWindow.width = 1366;
    expect(renderHook(() => useWideLayout()).result.current).toBe(false);
  });
});

describe('useSheetFrame', () => {
  afterEach(() => setPlatform('ios'));

  it('floats the sheet as a capped card on a desktop window', () => {
    setPlatform('web');
    mockWindow.width = 1440;
    const frame = renderHook(() => useSheetFrame()).result.current;
    expect(frame.style).toEqual({ maxWidth: 560 });
    expect(frame.backdropClassName).toBe('absolute inset-0');
  });

  it('leaves the phone sheet unchanged', () => {
    setPlatform('ios');
    mockWindow.width = 390;
    expect(renderHook(() => useSheetFrame()).result.current).toEqual({});
  });
});
