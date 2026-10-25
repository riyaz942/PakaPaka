import {
  CONJUGATION_FORMS,
  conjugate,
  lookAlike,
  parseConjugationClass,
  type ConjugationClass,
  type ConjugationTable,
} from './conjugation';

const row = (t: ConjugationTable) => CONJUGATION_FORMS.map((k) => t[k].surface);

describe('conjugate', () => {
  it('godan look-alike 知る', () => {
    expect(row(conjugate({ primaryForm: '知る', furigana: '知[し]る' }, 'godan')!)).toEqual([
      '知る', '知らない', '知った', '知らなかった', '知ります', '知りません', '知りました', '知りませんでした',
    ]);
    expect(conjugate({ primaryForm: '知る', furigana: '知[し]る' }, 'godan')!.plainPastNegative.furigana)
      .toBe('知[し]らなかった');
  });

  it('ichidan 食べる', () =>
    expect(row(conjugate({ primaryForm: '食べる', furigana: '食[た]べる' }, 'ichidan')!)).toEqual([
      '食べる', '食べない', '食べた', '食べなかった', '食べます', '食べません', '食べました', '食べませんでした',
    ]));

  it.each([
    ['飲む', 'godan', '飲まない', '飲んだ', '飲みます'],
    ['買う', 'godan', '買わない', '買った', '買います'],
    ['書く', 'godan', '書かない', '書いた', '書きます'],
    ['泳ぐ', 'godan', '泳がない', '泳いだ', '泳ぎます'],
    ['話す', 'godan', '話さない', '話した', '話します'],
    ['待つ', 'godan', '待たない', '待った', '待ちます'],
    ['死ぬ', 'godan', '死なない', '死んだ', '死にます'],
    ['遊ぶ', 'godan', '遊ばない', '遊んだ', '遊びます'],
    ['行く', 'godan-iku', '行かない', '行った', '行きます'],
    ['ある', 'godan-ru-irregular', 'ない', 'あった', 'あります'],
    ['いらっしゃる', 'godan-honorific', 'いらっしゃらない', 'いらっしゃった', 'いらっしゃいます'],
    ['問う', 'godan-u-special', '問わない', '問うた', '問います'],
    ['する', 'suru', 'しない', 'した', 'します'],
    ['勉強する', 'suru', '勉強しない', '勉強した', '勉強します'],
    ['くる', 'kuru', 'こない', 'きた', 'きます'],
  ])('%s (%s)', (primaryForm, cls, neg, past, polite) => {
    const t = conjugate({ primaryForm, furigana: null }, cls as ConjugationClass)!;
    expect([t.plainNegative.surface, t.plainPast.surface, t.polite.surface]).toEqual([neg, past, polite]);
  });

  it('ある past negative is なかった', () =>
    expect(conjugate({ primaryForm: 'ある', furigana: null }, 'godan-ru-irregular')!.plainPastNegative.surface)
      .toBe('なかった'));

  it('来る keeps the kanji and changes its reading', () => {
    const t = conjugate({ primaryForm: '来る', furigana: '来[く]る' }, 'kuru')!;
    expect([t.plainNegative.furigana, t.plainPast.furigana, t.polite.furigana])
      .toEqual(['来[こ]ない', '来[き]た', '来[き]ます']);
    expect(t.plainNegative.surface).toBe('来ない');
  });

  it('する-verb furigana keeps the noun', () =>
    expect(conjugate({ primaryForm: '勉強する', furigana: '勉[べん]強[きょう]する' }, 'suru')!.plainPast.furigana)
      .toBe('勉[べん]強[きょう]した'));

  it('い adjective 高い', () =>
    expect(row(conjugate({ primaryForm: '高い', furigana: '高[たか]い' }, 'adj-i')!)).toEqual([
      '高い', '高くない', '高かった', '高くなかった', '高いです', '高くないです', '高かったです', '高くなかったです',
    ]));

  it('いい uses よ', () =>
    expect(row(conjugate({ primaryForm: 'いい', furigana: null }, 'adj-ii')!)).toEqual([
      'いい', 'よくない', 'よかった', 'よくなかった', 'いいです', 'よくないです', 'よかったです', 'よくなかったです',
    ]));

  it('かっこいい uses よ too', () =>
    expect(conjugate({ primaryForm: 'かっこいい', furigana: null }, 'adj-ii')!.plainNegative.surface)
      .toBe('かっこよくない'));

  it('な adjective 静か', () =>
    expect(row(conjugate({ primaryForm: '静か', furigana: '静[しず]か' }, 'adj-na')!)).toEqual([
      '静かだ', '静かじゃない', '静かだった', '静かじゃなかった',
      '静かです', '静かではありません', '静かでした', '静かではありませんでした',
    ]));

  it('returns null when unsure', () => {
    expect(conjugate({ primaryForm: '有る', furigana: '有[あ]る' }, 'godan-ru-irregular')).toBeNull();
    expect(conjugate({ primaryForm: '食べ', furigana: null }, 'ichidan')).toBeNull(); // no る
    expect(conjugate({ primaryForm: '高', furigana: null }, 'adj-i')).toBeNull(); // no い
  });
});

describe('parseConjugationClass', () => {
  it('rejects unknown strings', () => {
    expect(parseConjugationClass('godan')).toBe('godan');
    expect(parseConjugationClass('v5r')).toBeNull();
    expect(parseConjugationClass(null)).toBeNull();
  });
});

describe('lookAlike', () => {
  it('flags look-alike godan verbs and い-ending な adjectives only', () => {
    expect(lookAlike({ primaryForm: '知る', furigana: '知[し]る' }, 'godan')).toEqual({
      tag: 'Exception: looks ichidan',
      note: 'It ends in い-sound + る, so it looks ichidan. But 知る is godan. る → ら for ない.',
    });
    expect(lookAlike({ primaryForm: '帰る', furigana: '帰[かえ]る' }, 'godan')!.note).toContain('え-sound');
    expect(lookAlike({ primaryForm: 'きれい', furigana: null }, 'adj-na')).toEqual({
      tag: 'Exception: looks like an い adjective',
      note: 'It ends in い, but it is a な adjective. きれいじゃない, not きれくない.',
    });
    expect(lookAlike({ primaryForm: '食べる', furigana: '食[た]べる' }, 'ichidan')).toBeNull();
    expect(lookAlike({ primaryForm: '飲む', furigana: '飲[の]む' }, 'godan')).toBeNull();
    expect(lookAlike({ primaryForm: '静か', furigana: '静[しず]か' }, 'adj-na')).toBeNull();
  });
});
