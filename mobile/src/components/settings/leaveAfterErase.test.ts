import { Platform } from 'react-native';

import { leaveAfterErase } from '@/components/settings/leaveAfterErase';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

const originalOS = Platform.OS;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let assign: jest.Mock;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  mockReplace.mockClear();
  assign = jest.fn();
  Object.defineProperty(globalThis, 'window', {
    value: { location: { assign } },
    configurable: true,
  });
});

afterEach(() => {
  setPlatform(originalOS);
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
});

describe('leaveAfterErase', () => {
  it('web: opens the landing page with a full page load', () => {
    setPlatform('web');
    leaveAfterErase();
    expect(assign).toHaveBeenCalledWith('/');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('native: goes to the onboarding welcome screen', () => {
    setPlatform('ios');
    leaveAfterErase();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
    expect(assign).not.toHaveBeenCalled();
  });
});
