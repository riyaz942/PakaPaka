import { Platform } from 'react-native';

import {
  isWeb,
  supportsCurriculumOta,
  supportsNotifications,
  supportsTalk,
  supportsThemeOverride,
  supportsThirdPartyImport,
  supportsVoice,
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
});
