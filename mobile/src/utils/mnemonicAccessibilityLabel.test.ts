import { buildMnemonicAccessibilityLabel } from '@/utils/mnemonicAccessibilityLabel';

describe('mnemonicAccessibilityLabel', () => {
  it('prefers mnemonic text for accessibility label', () => {
    expect(buildMnemonicAccessibilityLabel('Radical one (一)', 'one', '一')).toBe(
      'Radical one (一)',
    );
  });

  it('strips highlight tags so a screen reader never announces the markup', () => {
    expect(
      buildMnemonicAccessibilityLabel(
        'Two legs mid-stride and no head at all: a <radical>person</radical>.',
        'person',
        '人',
      ),
    ).toBe('Two legs mid-stride and no head at all: a person.');
  });

  it('strips the vocabulary tag a word mnemonic lands on', () => {
    expect(
      buildMnemonicAccessibilityLabel(
        'A <kanji>mouth</kanji> that you walk into is an <vocabulary>entrance</vocabulary>.',
        'entrance',
        '入り口',
      ),
    ).toBe('A mouth that you walk into is an entrance.');
  });

  it('drops the character a tag names, which the app prints but nobody reads aloud', () => {
    expect(
      buildMnemonicAccessibilityLabel(
        'Give it a <kanji form="少">few</kanji> <kanji form="年">year</kanji>s, and the child grows into a <vocabulary form="少年">boy</vocabulary>.',
        'boy',
        '少年',
      ),
    ).toBe('Give it a few years, and the child grows into a boy.');
  });

  it('composes meaning and primary form when mnemonic text is absent', () => {
    expect(buildMnemonicAccessibilityLabel(null, 'one', '一')).toBe('one (一)');
  });

  it('returns default label when no descriptive props are provided', () => {
    expect(buildMnemonicAccessibilityLabel()).toBe('Mnemonic image unavailable');
  });

  it('strips the reading and grammar tags a grammar mnemonic carries', () => {
    expect(
      buildMnemonicAccessibilityLabel(
        'Koichi nods "<reading>OK</reading>": all set <grammar>for later</grammar>.',
        'do in advance',
        'ておく',
      ),
    ).toBe('Koichi nods "OK": all set for later.');
  });
});
