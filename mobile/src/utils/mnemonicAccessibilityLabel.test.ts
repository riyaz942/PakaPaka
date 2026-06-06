import {
  buildMnemonicAccessibilityLabel,
  isValidMnemonicImageUrl,
} from '@/utils/mnemonicAccessibilityLabel';

describe('mnemonicAccessibilityLabel', () => {
  it('prefers mnemonic text for accessibility label', () => {
    expect(buildMnemonicAccessibilityLabel('Radical one (一)', 'one', '一')).toBe(
      'Radical one (一)',
    );
  });

  it('composes meaning and primary form when mnemonic text is absent', () => {
    expect(buildMnemonicAccessibilityLabel(null, 'one', '一')).toBe('one (一)');
  });

  it('returns default label when no descriptive props are provided', () => {
    expect(buildMnemonicAccessibilityLabel()).toBe('Mnemonic image unavailable');
  });

  it('accepts https image URLs only', () => {
    expect(isValidMnemonicImageUrl('https://assets.japanese-learning.app/radicals/n5/ichi.png')).toBe(
      true,
    );
    expect(isValidMnemonicImageUrl('http://assets.japanese-learning.app/radicals/n5/ichi.png')).toBe(
      false,
    );
    expect(isValidMnemonicImageUrl('not-a-url')).toBe(false);
    expect(isValidMnemonicImageUrl(null)).toBe(false);
  });
});
