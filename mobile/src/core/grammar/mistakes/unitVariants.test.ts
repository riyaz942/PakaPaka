import type { AnswerUnit, DiagnosisWord } from './mistake.types';
import { PARTICLES, unitForm, unitVariants } from './unitVariants';

const unit = (surface: string, reading: string, over: Partial<AnswerUnit> = {}): AnswerUnit => ({
  surface,
  reading,
  role: 'word',
  itemId: 'w1',
  inGrammar: false,
  ...over,
});

const word = (over: Partial<DiagnosisWord>): DiagnosisWord => ({
  itemId: 'w1',
  primaryForm: '',
  furigana: null,
  conjugationClass: null,
  transitivity: null,
  partner: null,
  homophones: [],
  ...over,
});

const taberu = word({ primaryForm: '食べる', furigana: '食[た]べる', conjugationClass: 'ichidan' });
const kaeru = word({ primaryForm: '帰る', furigana: '帰[かえ]る', conjugationClass: 'godan' });
const kaku = word({ primaryForm: '書く', furigana: '書[か]く', conjugationClass: 'godan' });
const kirei = word({ primaryForm: 'きれい', furigana: null, conjugationClass: 'adj-na' });

describe('unitForm', () => {
  it('finds the form by surface or reading', () => {
    expect(unitForm(unit('食べました', 'たべました'), taberu)?.form).toBe('politePast');
    expect(unitForm(unit('たべました', 'たべました'), taberu)?.form).toBe('politePast');
    expect(unitForm(unit('書いて', 'かいて'), kaku)?.form).toBe('te');
    expect(unitForm(unit('書いた', 'かいた'), kaku)?.form).toBe('plainPast');
  });

  it('falls back to an い-adjective base for a bare unit ending in い', () => {
    expect(unitForm(unit('食べたい', 'たべたい', { role: 'other', itemId: null }), null)).toEqual({
      form: 'plain',
      base: { primaryForm: '食べたい', furigana: null, conjugationClass: 'adj-i' },
    });
  });

  it('is null for a particle or an unmatched unit', () => {
    expect(unitForm(unit('は', 'は', { role: 'particle', itemId: null }), null)).toBeNull();
    expect(unitForm(unit('先生', 'せんせい'), taberu)).toBeNull();
  });
});

describe('unitVariants', () => {
  const has = (variants: ReturnType<typeof unitVariants>, expected: object) =>
    expect(variants).toContainEqual(expected);

  it('swaps a particle for every other particle', () => {
    const variants = unitVariants(unit('は', 'は', { role: 'particle', itemId: null }), null);
    has(variants, { text: 'が', kind: 'particle_wrong' });
    expect(variants.map((v) => v.text)).not.toContain('は');
    expect(variants).toHaveLength(PARTICLES.length - 1);
  });

  it('offers the other seven forms with only the differing dims', () => {
    const variants = unitVariants(unit('食べました', 'たべました'), taberu);
    has(variants, { text: '食べる', kind: 'form', dims: { register: 'plain', tense: 'non-past' } });
    has(variants, { text: '食べます', kind: 'form', dims: { tense: 'non-past' } });
    has(variants, { text: 'たべます', kind: 'form', dims: { tense: 'non-past' } });
    expect(variants.map((v) => v.text)).not.toContain('食べました');
  });

  it('offers no form variants for a te form', () => {
    const variants = unitVariants(unit('書いて', 'かいて'), kaku);
    expect(variants.filter((v) => v.kind === 'form')).toEqual([]);
  });

  it('swaps verb group', () => {
    has(unitVariants(unit('帰ります', 'かえります'), kaeru), {
      text: '帰ます',
      kind: 'verb_group',
    });
  });

  it('offers wrong te/ta tails for a godan verb', () => {
    const variants = unitVariants(unit('書いて', 'かいて'), kaku);
    has(variants, { text: '書って', kind: 'te_ta', dictForm: '書く' });
    has(variants, { text: 'かって', kind: 'te_ta', dictForm: '書く' });
    expect(variants.map((v) => v.text)).not.toContain('書いて');
    has(unitVariants(unit('書いた', 'かいた'), kaku), {
      text: '書んだ',
      kind: 'te_ta',
      dictForm: '書く',
    });
  });

  it('swaps adjective type', () => {
    has(unitVariants(unit('きれいじゃない', 'きれいじゃない'), kirei), {
      text: 'きれいくない',
      kind: 'adjective_type',
    });
  });

  it('offers the transitivity partner in the same form', () => {
    const akeru = word({
      primaryForm: '開ける',
      furigana: '開[あ]ける',
      conjugationClass: 'ichidan',
      transitivity: 'transitive',
      partner: { primaryForm: '開く', furigana: '開[あ]く', conjugationClass: 'godan' },
    });
    has(unitVariants(unit('開けます', 'あけます'), akeru), {
      text: '開きます',
      kind: 'transitivity',
    });
  });

  it('offers homophones in the same form', () => {
    const au = word({
      primaryForm: '会う',
      furigana: '会[あ]う',
      conjugationClass: 'godan-u-special',
      homophones: [{ primaryForm: '合う', furigana: '合[あ]う', conjugationClass: 'godan' }],
    });
    has(unitVariants(unit('会います', 'あいます'), au), {
      text: '合います',
      kind: 'homophone_kanji',
    });
  });

  it('offers homophone primary forms for a classless word', () => {
    const koukou = word({
      primaryForm: '高校',
      furigana: '高校[こうこう]',
      homophones: [{ primaryForm: '航行', furigana: null, conjugationClass: null }],
    });
    has(unitVariants(unit('高校', 'こうこう'), koukou), { text: '航行', kind: 'homophone_kanji' });
  });

  it('drops one っ', () => {
    has(unitVariants(unit('切って', 'きって'), null), { text: 'きて', kind: 'spelling_sokuon' });
  });

  it('drops one long vowel', () => {
    const variants = unitVariants(unit('高校', 'こうこう'), null);
    has(variants, { text: 'ここう', kind: 'spelling_long_vowel' });
    has(variants, { text: 'こうこ', kind: 'spelling_long_vowel' });
    has(unitVariants(unit('コート', 'こーと'), null), {
      text: 'こと',
      kind: 'spelling_long_vowel',
    });
    has(unitVariants(unit('先生', 'せんせい'), null), {
      text: 'せんせ',
      kind: 'spelling_long_vowel',
    });
    has(unitVariants(unit('お母さん', 'おかあさん'), null), {
      text: 'おかさん',
      kind: 'spelling_long_vowel',
    });
  });

  it('conjugates a bare い-adjective unit with no word', () => {
    has(
      unitVariants(
        unit('食べたい', 'たべたい', { role: 'other', itemId: null, inGrammar: true }),
        null,
      ),
      {
        text: '食べたかった',
        kind: 'form',
        dims: { tense: 'past' },
      },
    );
  });
});
