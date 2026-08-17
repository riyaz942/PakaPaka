import { isVocabularyReadingUnlocked, resolvePromptType } from './promptResolver';

describe('resolvePromptType', () => {
  it('asks radicals for their meaning', () => {
    expect(resolvePromptType('radical')).toBe('meaning');
  });

  it('asks grammar for production', () => {
    expect(resolvePromptType('grammar')).toBe('production');
  });

  it('asks kanji for their meaning — the queue builder emits the paired reading card', () => {
    expect(resolvePromptType('kanji')).toBe('meaning');
  });

  it('asks vocabulary for its meaning: rep parity is gone (v2 rule 2)', () => {
    expect(resolvePromptType('vocabulary')).toBe('meaning');
  });
});

describe('isVocabularyReadingUnlocked', () => {
  it('is false while any kanji in the word is unlearned (v2 rule 1)', () => {
    expect(isVocabularyReadingUnlocked('写真', ['写', '真'])).toBe(false);
    expect(isVocabularyReadingUnlocked('写真', ['真'])).toBe(false);
  });

  it('is true once every kanji in the word is learned', () => {
    expect(isVocabularyReadingUnlocked('写真', [])).toBe(true);
    expect(isVocabularyReadingUnlocked('食べる', [])).toBe(true);
  });

  it('is false for kana-only vocabulary — its reading is its surface form', () => {
    expect(isVocabularyReadingUnlocked('これ', [])).toBe(false);
    expect(isVocabularyReadingUnlocked('カメラ', [])).toBe(false);
  });
});
