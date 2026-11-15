import { Platform } from 'react-native';

import {
  isWeb,
  supportsCurriculumOta,
  supportsNativeGoogleSignIn,
  supportsNotifications,
  supportsTalk,
  supportsThemeOverride,
  supportsThirdPartyImport,
  supportsVoice,
  usesCookieSession,
} from '@/platform/capabilities';

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

const supports = [
  supportsTalk,
  supportsVoice,
  supportsNotifications,
  supportsThemeOverride,
  supportsCurriculumOta,
  supportsThirdPartyImport,
];

describe('capabilities', () => {
  afterEach(() => setPlatform('ios'));

  it('reports web as the only platform without native features', () => {
    setPlatform('web');
    expect(isWeb()).toBe(true);
    for (const supported of supports) {
      expect(supported()).toBe(false);
    }
  });

  it.each(['ios', 'android'] as const)('supports every native feature on %s', (os) => {
    setPlatform(os);
    expect(isWeb()).toBe(false);
    for (const supported of supports) {
      expect(supported()).toBe(true);
    }
  });

  it('uses native Google sign-in on ios/android and the cookie session on web', () => {
    setPlatform('ios');
    expect(supportsNativeGoogleSignIn()).toBe(true);
    expect(usesCookieSession()).toBe(false);
    setPlatform('android');
    expect(supportsNativeGoogleSignIn()).toBe(true);
    expect(usesCookieSession()).toBe(false);
    setPlatform('web');
    expect(supportsNativeGoogleSignIn()).toBe(false);
    expect(usesCookieSession()).toBe(true);
  });
});
