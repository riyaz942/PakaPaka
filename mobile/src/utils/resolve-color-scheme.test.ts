import { resolveColorScheme } from '@/utils/resolve-color-scheme';

describe('resolveColorScheme', () => {
  it('returns dark for null (dark-first default)', () => {
    expect(resolveColorScheme(null)).toBe('dark');
  });

  it('returns dark for dark', () => {
    expect(resolveColorScheme('dark')).toBe('dark');
  });

  it('returns light only when explicitly light', () => {
    expect(resolveColorScheme('light')).toBe('light');
  });
});
