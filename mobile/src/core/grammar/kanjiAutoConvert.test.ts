import * as wanakana from 'wanakana';

import { evaluateGrammarBuild } from './buildEvaluator';
import {
  applyKanjiConversions,
  buildKanjiConversions,
  undoneKanjiConversions,
  type KanjiConversion,
} from './kanjiAutoConvert';

/** Types `romaji` one key at a time, the way WanaKanaInput sees it. */
function typeRomaji(romaji: string, conversions: readonly KanjiConversion[], start = ''): string {
  let raw = start;
  let value = start;
  for (const key of romaji) {
    raw = value + key;
    value = applyKanjiConversions(value, wanakana.toKana(raw, { IMEMode: true }), conversions);
  }
  return value;
}

/** Types kana one character at a time (Japanese keyboard). */
function typeKana(kana: string, conversions: readonly KanjiConversion[], start = ''): string {
  let value = start;
  for (const ch of kana) value = applyKanjiConversions(value, value + ch, conversions);
  return value;
}

describe('buildKanjiConversions', () => {
  it('maps each annotated run of two or more kana to its kanji', () => {
    expect(buildKanjiConversions(['明日[あした]は忙[いそが]しいです。'])).toEqual([
      { kana: 'あした', kanji: '明日' },
      { kana: 'いそが', kanji: '忙' },
    ]);
  });

  it('gives a one-kana reading the kana after it as context', () => {
    expect(buildKanjiConversions(['映画[えいが]を見[み]ました。'])).toEqual([
      { kana: 'えいが', kanji: '映画' },
      { kana: 'みま', kanji: '見ま' },
    ]);
  });

  it('adds the whole word for kanji annotated one by one', () => {
    expect(buildKanjiConversions(['会[かい]社[しゃ]に行[い]きます。'])).toEqual([
      { kana: 'かいしゃ', kanji: '会社' },
      { kana: 'かい', kanji: '会' },
      { kana: 'しゃ', kanji: '社' },
      { kana: 'いき', kanji: '行き' },
    ]);
  });

  it('merges the runs of every answer without duplicates', () => {
    const conversions = buildKanjiConversions([
      '明日[あした]は忙[いそが]しいです。',
      '私[わたし]は明日[あした]忙[いそが]しいです。',
    ]);
    expect(conversions.map((c) => c.kana)).toEqual(['あした', 'いそが', 'あしたいそが', 'わたし']);
  });
});

describe('applyKanjiConversions', () => {
  const conversions = buildKanjiConversions([
    '明日[あした]は忙[いそが]しいです。',
    '私[わたし]は昨日[きのう]映画[えいが]を見[み]ました。',
  ]);

  it('converts a word as soon as its romaji completes it', () => {
    expect(typeRomaji('ashita', conversions)).toBe('明日');
    expect(typeRomaji('ashitahaisogashiidesu', conversions)).toBe('明日は忙しいです');
  });

  it('converts kana typed on a Japanese keyboard', () => {
    expect(typeKana('あしたはいそがしいです', conversions)).toBe('明日は忙しいです');
  });

  it('converts a word committed in one chunk', () => {
    expect(applyKanjiConversions('', 'わたしはきのうえいがを', conversions)).toBe('私は昨日映画を');
  });

  it('converts a one-kana reading only with its following kana', () => {
    expect(typeRomaji('mi', conversions)).toBe('み');
    expect(typeRomaji('mimashita', conversions)).toBe('見ました');
    expect(typeRomaji('minnna', conversions)).toBe('みんな');
  });

  describe('with a word whose kanji are annotated one by one', () => {
    const word = buildKanjiConversions(['会[かい]社[しゃ]に行[い]きます。', '会[かい]に行[い]きます。']);

    it('waits for the whole word', () => {
      expect(typeRomaji('kai', word)).toBe('かい');
      expect(typeRomaji('kaish', word)).toBe('かいsh');
      expect(typeRomaji('kaisha', word)).toBe('会社');
      expect(typeKana('かいしゃ', word)).toBe('会社');
      expect(typeRomaji('kaishaniikimasu', word)).toBe('会社に行きます');
    });

    it('converts the shorter word when the next kana breaks the longer one', () => {
      expect(typeRomaji('kaini', word)).toBe('会に');
      expect(typeRomaji('kainiikimasu', word)).toBe('会に行きます');
    });

    it('keeps waiting kana when the learner undid it', () => {
      expect(applyKanjiConversions('かい', 'かいに', word, new Set(['かい', 'かいしゃ']))).toBe('かいに');
    });
  });

  it('leaves kana that is not a word of this card', () => {
    expect(typeRomaji('kyouhasamui', conversions)).toBe('きょうはさむい');
  });

  it('does not convert on deletion', () => {
    expect(applyKanjiConversions('あしたは', 'あした', conversions)).toBe('あした');
  });

  it('skips conversions the learner undid', () => {
    expect(applyKanjiConversions('', 'あした', conversions, new Set(['あした']))).toBe('あした');
  });

  it('does nothing without conversions', () => {
    expect(typeRomaji('ashita', [])).toBe('あした');
  });

  it('keeps a typed answer correct', () => {
    const key = {
      answers: ['私[わたし]は昨日[きのう]映画[えいが]を見[み]ました。'],
      otherGrammarAnswers: [],
      userAnswers: [],
    };
    const typed = typeRomaji('watashihakinoueigawomimashita.', buildKanjiConversions(key.answers));
    expect(typed).toBe('私は昨日映画を見ました。');
    expect(evaluateGrammarBuild(typed, key)).toBe('correct');
  });
});

describe('undoneKanjiConversions', () => {
  const conversions = buildKanjiConversions(['明日[あした]は映画[えいが]を見[み]ます。']);

  it('names the conversion whose kanji was deleted', () => {
    expect(undoneKanjiConversions('明日は見ま', '明日は', conversions)).toEqual(['みま']);
    expect(undoneKanjiConversions('明日', '明', conversions)).toEqual(['あした']);
  });

  it('ignores deleted kana and typing', () => {
    expect(undoneKanjiConversions('明日は', '明日', conversions)).toEqual([]);
    expect(undoneKanjiConversions('明日', '明日は', conversions)).toEqual([]);
  });
});
