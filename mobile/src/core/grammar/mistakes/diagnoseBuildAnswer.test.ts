import type { GrammarSentenceCard } from '@/core/srs/srs.types';

import { diagnoseBuildAnswer } from './diagnoseBuildAnswer';
import type { AnswerUnit, DiagnosisWord } from './mistake.types';

const unit = (surface: string, reading: string, over: Partial<AnswerUnit> = {}): AnswerUnit => ({
  surface,
  reading,
  role: 'word',
  itemId: null,
  inGrammar: false,
  ...over,
});
const particle = (p: string) => unit(p, p, { role: 'particle' });
const grammar = (text: string) => unit(text, text, { role: 'other', inGrammar: true });

const word = (
  itemId: string,
  primaryForm: string,
  furigana: string,
  conjugationClass: DiagnosisWord['conjugationClass'],
  over: Partial<DiagnosisWord> = {},
): DiagnosisWord => ({
  itemId,
  primaryForm,
  furigana,
  conjugationClass,
  transitivity: null,
  partner: null,
  homophones: [],
  ...over,
});

const words: Record<string, DiagnosisWord> = {
  study: word('study', '勉強する', '勉強[べんきょう]する', 'suru'),
  kaeru: word('kaeru', '帰る', '帰[かえ]る', 'godan'),
  kiru: word('kiru', '着る', '着[き]る', 'ichidan'),
  akeru: word('akeru', '開ける', '開[あ]ける', 'ichidan', {
    transitivity: 'transitive',
    partner: {
      primaryForm: '開く',
      furigana: '開[あ]く',
      conjugationClass: 'godan',
    },
  }),
  matsu: word('matsu', '待つ', '待[ま]つ', 'godan'),
};

const card = (answers: AnswerUnit[][], userAnswers: string[] = []): GrammarSentenceCard => ({
  sentenceKey: 'k',
  japanese: '',
  furigana: null,
  english: '',
  spans: [],
  grammarSpan: { start: 0, end: 0 },
  register: 'polite',
  vocabulary: [],
  answers: [],
  otherGrammarAnswers: [],
  userAnswers,
  diagnosisKey: { answers, words },
});

// 今年は学校で日本語を勉強します
const study: AnswerUnit[] = [
  unit('今年', 'ことし'),
  particle('は'),
  unit('学校', 'がっこう'),
  particle('で'),
  unit('日本語', 'にほんご'),
  particle('を'),
  unit('勉強します', 'べんきょうします', { itemId: 'study', inGrammar: true }),
];
const home = (p: string): AnswerUnit[] => [
  unit('家', 'いえ'),
  particle(p),
  unit('帰りました', 'かえりました', { itemId: 'kaeru' }),
];
// 昼ご飯を作ったのに友達はもう食べました (real units of sentence 3746)
const noni: AnswerUnit[] = [
  unit('昼ご飯', 'ひるごはん'),
  particle('を'),
  unit('作った', 'つくった'),
  grammar('のに'),
  unit('友達', 'ともだち'),
  particle('は'),
  unit('もう', 'もう'),
  unit('食べました', 'たべました'),
];

const diagnose = (input: string, c: GrammarSentenceCard) => diagnoseBuildAnswer(input, c, '〜のに');

describe('diagnoseBuildAnswer', () => {
  it('finds a missing particle, a wrong particle and a wrong form', () => {
    const result = diagnose('今年学校に日本語を勉強する', card([study]));
    expect(result?.lines).toEqual([]);
    expect(result?.marks).toEqual([
      {
        kind: 'particle_missing',
        rawStart: 2,
        rawEnd: 2,
        typed: '',
        expected: ['は'],
        before: '今年',
        after: '学校',
      },
      {
        kind: 'particle_wrong',
        rawStart: 4,
        rawEnd: 5,
        typed: 'に',
        expected: ['で'],
        before: '学校',
        after: '日本語',
      },
      {
        kind: 'form',
        rawStart: 9,
        rawEnd: 13,
        typed: '勉強する',
        expected: ['勉強します'],
        before: 'を',
        after: null,
        dims: { register: 'polite' },
      },
    ]);
  });

  it("gives the answer form's values in dims (R2)", () => {
    const result = diagnose('家へ帰ります', card([home('に'), home('へ')]));
    expect(result?.marks).toEqual([
      expect.objectContaining({
        kind: 'form',
        typed: '帰ります',
        dims: { tense: 'past' },
      }),
    ]);
  });

  it('names every accepted particle at a place', () => {
    const result = diagnose('家で帰りました', card([home('に'), home('へ')]));
    expect(result?.marks).toEqual([
      expect.objectContaining({
        kind: 'particle_wrong',
        typed: 'で',
        expected: ['に', 'へ'],
      }),
    ]);
  });

  it('allows what a saved answer has at a place', () => {
    const result = diagnose(
      '今年学校で日本語を勉強しました',
      card([study], ['今年は学校で日本語を勉強しました']),
    );
    expect(result?.marks.map((m) => m.kind)).toEqual(['particle_missing']);
  });

  it('counts allowed units as matched for the half limit (R8)', () => {
    const result = diagnose(
      '去年大学に日本語を勉強する',
      card([study], ['去年は大学で日本語を勉強します']),
    );
    expect(result?.marks.map((m) => m.kind)).toEqual([
      'particle_missing',
      'particle_wrong',
      'form',
    ]);
  });

  it('returns null when the answer is too different', () => {
    expect(diagnose('今年が学校に日本語で勉強する', card([study]))).toBeNull(); // 4 marks
    expect(diagnose('明日今年が学校に日本語で勉強する', card([study]))).toBeNull(); // 5 marks
    expect(diagnose('去年は大学で英語を勉強します', card([study]))).toBeNull(); // 1 of 4 words
    expect(diagnose('私は', card([study]))).toBeNull();
  });

  it('returns null for empty input or no diagnosis key', () => {
    expect(diagnose('', card([study]))).toBeNull();
    expect(diagnose('。 ', card([study]))).toBeNull();
    expect(diagnose('ことしはがっこうで日本語を勉強します', card([study]))).toBeNull(); // nothing wrong
    expect(
      diagnose('今年学校で日本語を勉強します', {
        ...card([study]),
        diagnosisKey: null,
      }),
    ).toBeNull();
  });

  it('does not crash on one character or a sentence with no particles', () => {
    expect(() => diagnose('あ', card([study]))).not.toThrow();
    const noParticles = [unit('はい', 'はい'), unit('そうです', 'そうです')];
    expect(() => diagnose('いいえ', card([noParticles]))).not.toThrow();
    expect(() => diagnose('はいそう', card([[]]))).not.toThrow();
  });

  it('says word order when the words are right and only their order is wrong (R3)', () => {
    expect(diagnose('学校で日本語を今年は勉強します', card([study]))).toEqual({
      marks: [],
      lines: [expect.objectContaining({ kind: 'word_order', expected: [] })],
    });
  });

  it('does not call swapped particles a word order mistake', () => {
    const result = diagnose('今年で学校は日本語を勉強します', card([study]));
    expect(result?.lines).toEqual([]);
    expect(result?.marks.map((m) => m.kind)).toEqual(['particle_wrong', 'particle_wrong']);
  });

  it('says grammar not used when only the grammar text differs', () => {
    expect(diagnose('昼ご飯を作ったけど友達はもう食べました', card([noni]))).toEqual({
      marks: [],
      lines: [expect.objectContaining({ kind: 'grammar_not_used' })],
    });
    // A replaced grammar unit plus extra text beside it is still the grammar not used.
    expect(
      diagnose('昼ご飯を作ったにもかかわらずけれど友達はもう食べました', card([noni]))?.lines,
    ).toEqual([expect.objectContaining({ kind: 'grammar_not_used' })]);
  });

  it('keeps marks when the grammar is used or other mistakes exist (R5)', () => {
    // のに is there; けど is only extra.
    const extra = diagnose('昼ご飯を作ったのにけど友達はもう食べました', card([noni]));
    expect(extra?.lines).toEqual([]);
    expect(extra?.marks).toEqual([
      expect.objectContaining({
        kind: 'word_extra',
        typed: 'けど',
        expected: [],
      }),
    ]);
    // A particle mistake too: every mistake keeps its own mark.
    const mixed = diagnose('昼ご飯が作ったけど友達はもう食べました', card([noni]));
    expect(mixed?.lines).toEqual([]);
    expect(mixed?.marks.map((m) => m.kind)).toEqual(['particle_wrong', 'wrong_word']);
  });

  it('keeps wrong_word on a grammar word unit (R5)', () => {
    // ちょっと待ってください: 待って is a word unit inside the grammar span.
    const wait = [
      unit('ちょっと', 'ちょっと'),
      unit('待って', 'まって', { itemId: 'matsu', inGrammar: true }),
      grammar('ください'),
    ];
    const result = diagnose('ちょっと来てください', card([wait]));
    expect(result?.lines).toEqual([]);
    expect(result?.marks).toEqual([
      expect.objectContaining({
        kind: 'wrong_word',
        typed: '来て',
        expected: ['待って'],
      }),
    ]);
  });

  it('places a gap at the raw offset of the next character', () => {
    const coat = [
      unit('コート', 'こーと'),
      particle('を'),
      unit('着ます', 'きます', { itemId: 'kiru' }),
    ];
    const result = diagnose('コート、きます', card([coat]));
    expect(result?.marks).toEqual([
      expect.objectContaining({
        kind: 'particle_missing',
        before: 'コート',
        after: 'きます',
        rawStart: 4,
        rawEnd: 4,
      }),
    ]);
  });

  it('fills transitivity and dictForm from the answer word', () => {
    const door = [
      unit('ドア', 'どあ'),
      particle('を'),
      unit('開けます', 'あけます', { itemId: 'akeru' }),
    ];
    expect(diagnose('ドアを開きます', card([door]))?.marks).toEqual([
      expect.objectContaining({
        kind: 'transitivity',
        expected: ['開けます'],
        transitivity: 'transitive',
      }),
    ]);
    expect(diagnose('家に帰ました', card([home('に')]))?.marks).toEqual([
      expect.objectContaining({ kind: 'verb_group', dictForm: '帰る' }),
    ]);
  });

  it('marks extra particles and missing words', () => {
    const extra = diagnose('今年は学校で日本語をを勉強します', card([study]));
    expect(extra?.marks).toEqual([
      expect.objectContaining({
        kind: 'particle_extra',
        typed: 'を',
        expected: [],
      }),
    ]);
    const missing = diagnose('今年は学校で日本語を', card([study]));
    expect(missing?.marks).toEqual([
      expect.objectContaining({
        kind: 'word_missing',
        expected: ['勉強します'],
        rawStart: 10,
      }),
    ]);
  });
});
