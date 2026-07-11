/**
 * Character-script predicates for prompt routing and wrong-script detection.
 * Kanji covers the CJK Unified Ideograph blocks (incl. Extension A and
 * compatibility ideographs); kana covers hiragana + katakana.
 */

const KANJI_REGEX = /[㐀-䶿一-鿿豈-﫿]/;
const KANA_REGEX = /[぀-ヿ]/;

export function hasKanji(text: string): boolean {
  return KANJI_REGEX.test(text);
}

export function hasKana(text: string): boolean {
  return KANA_REGEX.test(text);
}

/** True when the text contains any kana or kanji character. */
export function hasJapaneseScript(text: string): boolean {
  return hasKana(text) || hasKanji(text);
}
