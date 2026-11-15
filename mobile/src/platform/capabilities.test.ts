import { Platform } from 'react-native';

import {
  isWeb,
  needsIosGoogleClientId,
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

  it.each(['ios', 'android'] as const)(
    'uses native Google sign-in, not the cookie session, on %s',
    (os) => {
      setPlatform(os);
      expect(supportsNativeGoogleSignIn()).toBe(true);
      expect(usesCookieSession()).toBe(false);
    },
  );

  it('uses the cookie session, not native Google sign-in, on web', () => {
    setPlatform('web');
    expect(supportsNativeGoogleSignIn()).toBe(false);
    expect(usesCookieSession()).toBe(true);
  });

  it.each([
    ['ios', true],
    ['android', false],
    ['web', false],
  ] as const)('needs a separate Google client ID only on iOS (%s: %s)', (os, expected) => {
    setPlatform(os);
    expect(needsIosGoogleClientId()).toBe(expected);
  });
});
