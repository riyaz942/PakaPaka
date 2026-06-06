import { isSessionIntensity } from '@/data/user/sessionIntensity.types';

describe('isSessionIntensity', () => {
  it('accepts valid intensity literals', () => {
    expect(isSessionIntensity('relaxed')).toBe(true);
    expect(isSessionIntensity('intense')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isSessionIntensity('standard')).toBe(false);
    expect(isSessionIntensity('Relaxed')).toBe(false);
    expect(isSessionIntensity('')).toBe(false);
    expect(isSessionIntensity('intense ')).toBe(false);
  });
});
