import {
  SESSION_INTENSITY_VALUES,
  isSessionIntensity,
} from '@/data/user/sessionIntensity.types';

describe('isSessionIntensity', () => {
  it('accepts valid intensity literals', () => {
    expect(isSessionIntensity('relaxed')).toBe(true);
    expect(isSessionIntensity('intense')).toBe(true);
  });

  it('accepts the light, steady and immersive tiers', () => {
    expect(isSessionIntensity('light')).toBe(true);
    expect(isSessionIntensity('steady')).toBe(true);
    expect(isSessionIntensity('immersive')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isSessionIntensity('standard')).toBe(false);
    expect(isSessionIntensity('Relaxed')).toBe(false);
    expect(isSessionIntensity('')).toBe(false);
    expect(isSessionIntensity('intense ')).toBe(false);
  });

  it('lists all five tiers lightest to heaviest', () => {
    expect(SESSION_INTENSITY_VALUES).toEqual([
      'light',
      'relaxed',
      'steady',
      'intense',
      'immersive',
    ]);
  });
});
