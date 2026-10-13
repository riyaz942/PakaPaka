import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetExampleSentences,
  __mockSetExampleSentenceSpans,
  __mockSetGrammarSentenceAnswers,
  __mockSetItems,
} from '../../../__mocks__/expo-sqlite';

import { getGrammarSentencePool, getItemFormsByIds } from '@/data/curriculum/grammarPoolRepository';

describe('grammarPoolRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('returns only pool rows, with span, register and both answer kinds', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetExampleSentences('curriculum.db.test', [
      {
        id: 1, item_id: 50, japanese: '寒いから、コートを着ます。',
        furigana: '寒[さむ]いから、コートを着[き]ます。', english: "Because it's cold, I'll wear a coat.",
        sort_order: 0, grammar_start: 2, grammar_end: 4, register: 'polite',
      },
      { id: 2, item_id: 50, japanese: '古い例。', furigana: null, english: 'Old.', sort_order: 1 },
    ]);
    __mockSetExampleSentenceSpans('curriculum.db.test', [
      { sentence_id: 1, item_id: 20, start_offset: 0, end_offset: 2, inflection: null, sort_order: 0 },
    ]);
    __mockSetGrammarSentenceAnswers('curriculum.db.test', [
      { id: 2, sentence_id: 1, answer_furigana: '寒[さむ]いので、コートを着[き]ます。', kind: 'other_grammar', sort_order: 1 },
      { id: 1, sentence_id: 1, answer_furigana: '寒[さむ]いですから、コートを着[き]ます。', kind: 'valid', sort_order: 0 },
    ]);

    const pool = getGrammarSentencePool(db, '50');

    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({
      id: '1',
      japanese: '寒いから、コートを着ます。',
      grammarStart: 2,
      grammarEnd: 4,
      register: 'polite',
      validAnswers: ['寒[さむ]いですから、コートを着[き]ます。'],
      otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'],
    });
    expect(pool[0].spans).toEqual([
      { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
    ]);
  });

  it('maps vocabulary ids to dictionary form and furigana', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', [
      { id: 20, item_type: 'vocabulary', jlpt_level: 'N5', slug: 'samui', primary_form: '寒い', furigana: '寒[さむ]い', meaning: 'cold', mnemonic_text: null, visual_mnemonic_url: null, sort_order: 1 },
      { id: 21, item_type: 'vocabulary', jlpt_level: 'N5', slug: 'kooto', primary_form: 'コート', furigana: null, meaning: 'coat', mnemonic_text: null, visual_mnemonic_url: null, sort_order: 2 },
    ]);

    const forms = getItemFormsByIds(db, ['20', '21']);

    expect(forms.get('20')).toEqual({ primaryForm: '寒い', furigana: '寒[さむ]い' });
    expect(forms.get('21')).toEqual({ primaryForm: 'コート', furigana: null });
  });
});
