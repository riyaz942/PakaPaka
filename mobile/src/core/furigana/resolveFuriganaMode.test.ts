import { resolveFuriganaMode } from '@/core/furigana/resolveFuriganaMode';

describe('resolveFuriganaMode', () => {
  it('falls back to the global mode when the word has no override', () => {
    expect(resolveFuriganaMode(null, 'auto')).toBe('auto');
    expect(resolveFuriganaMode(null, 'shown')).toBe('shown');
    expect(resolveFuriganaMode(null, 'hidden')).toBe('hidden');
  });

  it('lets a Settings override win over every global mode', () => {
    expect(resolveFuriganaMode('shown', 'hidden')).toBe('shown');
    expect(resolveFuriganaMode('hidden', 'shown')).toBe('hidden');
  });

  it('short-circuits the SRS default when an override exists', () => {
    // 'auto' is what defers to mastery; an override never resolves to 'auto',
    // so the mastery tier below it is never consulted for that word.
    expect(resolveFuriganaMode('shown', 'auto')).toBe('shown');
    expect(resolveFuriganaMode('hidden', 'auto')).toBe('hidden');
  });

  it('treats undefined the same as no override', () => {
    expect(resolveFuriganaMode(undefined, 'auto')).toBe('auto');
  });
});
