import { hasJapaneseScript, hasKana, hasKanji } from './scriptDetection';

describe('hasKanji', () => {
  it('detects CJK ideographs', () => {
    expect(hasKanji('食')).toBe(true);
    expect(hasKanji('食べる')).toBe(true);
    expect(hasKanji('一')).toBe(true);
  });

  it('is false for kana-only and Latin text', () => {
    expect(hasKanji('これ')).toBe(false);
    expect(hasKanji('カメラ')).toBe(false);
    expect(hasKanji('kore')).toBe(false);
    expect(hasKanji('')).toBe(false);
  });
});

describe('hasKana', () => {
  it('detects hiragana and katakana', () => {
    expect(hasKana('これ')).toBe(true);
    expect(hasKana('カメラ')).toBe(true);
    expect(hasKana('食べる')).toBe(true);
  });

  it('is false for kanji-only and Latin text', () => {
    expect(hasKana('一')).toBe(false);
    expect(hasKana('two')).toBe(false);
  });
});

describe('hasJapaneseScript', () => {
  it('detects any kana or kanji', () => {
    expect(hasJapaneseScript('二')).toBe(true);
    expect(hasJapaneseScript('に')).toBe(true);
    expect(hasJapaneseScript('ニ')).toBe(true);
  });

  it('is false for pure Latin input', () => {
    expect(hasJapaneseScript('number two')).toBe(false);
    expect(hasJapaneseScript('2')).toBe(false);
  });
});
