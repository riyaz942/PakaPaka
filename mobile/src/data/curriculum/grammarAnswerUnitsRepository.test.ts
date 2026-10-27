import type { SQLiteDatabase } from 'expo-sqlite';

import { getBuildDiagnosisKey } from '@/data/curriculum/grammarAnswerUnitsRepository';

type Row = Record<string, unknown>;

const unit = (answer_id: number | null, surface: string, role: string, item_id: number | null = null, in_grammar = 0) => ({
  answer_id, surface, reading: surface, role, item_id, in_grammar,
});

/** Answers each query by its SQL text; `tables` stays empty to model an old curriculum.db. */
function fakeDb(parts: { tables: string[]; units?: Row[]; words?: Row[]; homophones?: Row[] }) {
  const calls: string[] = [];
  const db = {
    getAllSync: (sql: string) => {
      calls.push(sql);
      if (/sqlite_master/.test(sql)) return parts.tables.map((name) => ({ name }));
      if (/FROM grammar_answer_units/.test(sql)) return parts.units ?? [];
      if (/FROM accepted_answers/.test(sql)) return parts.homophones ?? [];
      if (/FROM items i/.test(sql)) return parts.words ?? [];
      throw new Error(`unexpected query: ${sql}`);
    },
  } as unknown as SQLiteDatabase;
  return { db, calls };
}

describe('getBuildDiagnosisKey', () => {
  it('returns null when the units table is missing', () => {
    const { db, calls } = fakeDb({ tables: [] });

    expect(getBuildDiagnosisKey(db, '7')).toBeNull();
    // Nothing else is queried: an old DB has no items.transitivity_partner_id.
    expect(calls).toHaveLength(1);
  });

  it('returns null when the sentence has no units', () => {
    const { db } = fakeDb({ tables: ['grammar_answer_units'] });

    expect(getBuildDiagnosisKey(db, '7')).toBeNull();
  });

  it('returns the sentence units first, then valid alternates in sort order', () => {
    const { db } = fakeDb({
      tables: ['grammar_answer_units'],
      // The query orders the rows; the repository only has to cut them at answer changes.
      units: [
        unit(null, '今年', 'word', 1),
        unit(null, 'は', 'particle'),
        unit(null, '寒い', 'word', 2, 1),
        unit(11, '今年', 'word', 1),
        unit(11, 'も', 'particle'),
        unit(12, 'ことし', 'word', 1),
      ],
      words: [
        { id: 1, primary_form: '今年', furigana: '今年[ことし]', conjugation_class: null, word_type: 'noun' },
        { id: 2, primary_form: '寒い', furigana: '寒[さむ]い', conjugation_class: 'adj-i', word_type: 'i-adjective' },
      ],
    });

    const key = getBuildDiagnosisKey(db, '7')!;

    expect(key.answers.map((answer) => answer.map((u) => u.surface))).toEqual([
      ['今年', 'は', '寒い'],
      ['今年', 'も'],
      ['ことし'],
    ]);
    expect(key.answers[0][2]).toEqual({ surface: '寒い', reading: '寒い', role: 'word', itemId: '2', inGrammar: true });
    expect(key.answers[0][1]).toMatchObject({ role: 'particle', itemId: null, inGrammar: false });
  });

  it('loads conjugation class, transitivity, partner and homophones', () => {
    const { db, calls } = fakeDb({
      tables: ['grammar_answer_units'],
      units: [unit(null, '開けた', 'word', 309), unit(null, '会った', 'word', 338)],
      words: [
        {
          id: 309, primary_form: '開ける', furigana: '開[あ]ける', conjugation_class: 'ichidan',
          word_type: 'ichidan verb, transitive verb',
          partner_primary_form: '開く', partner_furigana: '開[あ]く', partner_conjugation_class: 'godan',
        },
        {
          id: 338, primary_form: '会う', furigana: '会[あ]う', conjugation_class: 'godan',
          word_type: 'godan verb, intransitive verb',
          partner_primary_form: null, partner_furigana: null, partner_conjugation_class: null,
        },
      ],
      homophones: [{ word_id: 338, primary_form: '合う', furigana: '合[あ]う', conjugation_class: 'godan' }],
    });

    const key = getBuildDiagnosisKey(db, '7')!;

    expect(key.words['309']).toEqual({
      itemId: '309', primaryForm: '開ける', furigana: '開[あ]ける', conjugationClass: 'ichidan',
      transitivity: 'transitive',
      partner: { primaryForm: '開く', furigana: '開[あ]く', conjugationClass: 'godan' },
      homophones: [],
    });
    expect(key.words['338']).toMatchObject({
      transitivity: 'intransitive',
      partner: null,
      homophones: [{ primaryForm: '合う', furigana: '合[あ]う', conjugationClass: 'godan' }],
    });
    // sqlite_master check, units, words, homophones.
    expect(calls).toHaveLength(4);
  });

  it('leaves transitivity null for words that are not tagged as verbs of either kind', () => {
    const { db } = fakeDb({
      tables: ['grammar_answer_units'],
      units: [unit(null, '犬', 'word', 5)],
      words: [{ id: 5, primary_form: '犬', furigana: '犬[いぬ]', conjugation_class: null, word_type: 'noun' }],
    });

    expect(getBuildDiagnosisKey(db, '7')!.words['5']).toMatchObject({
      transitivity: null,
      conjugationClass: null,
      partner: null,
    });
  });

  it('leaves transitivity null for a verb tagged as both transitive and intransitive', () => {
    const { db } = fakeDb({
      tables: ['grammar_answer_units'],
      units: [unit(null, '始まる', 'word', 6)],
      words: [
        {
          id: 6, primary_form: '始まる', furigana: '始[はじ]まる', conjugation_class: 'godan',
          word_type: 'godan verb, transitive verb, intransitive verb',
        },
      ],
    });

    expect(getBuildDiagnosisKey(db, '7')!.words['6'].transitivity).toBeNull();
  });
});
