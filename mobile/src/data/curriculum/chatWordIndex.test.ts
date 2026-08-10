import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetExampleSentences,
  __mockSetExampleSentenceSpans,
  __mockSetItems,
  __mockSetPassageWordSpans,
  __mockSetReadingPassages,
} from '../../../__mocks__/expo-sqlite';

import { getChatWordIndex } from '@/data/curriculum/chatWordIndex';

const DB_NAME = 'curriculum.db';

async function openCurriculum() {
  return openDatabaseAsync(DB_NAME);
}

function seed() {
  __mockSetItems(DB_NAME, [
    { id: 1, item_type: 'vocabulary', primary_form: '食べる', slug: 'taberu-v' },
    { id: 2, item_type: 'vocabulary', primary_form: '来る', slug: 'kuru-v' },
    { id: 3, item_type: 'kanji', primary_form: '食', slug: 'kanji-taberu' },
    // Same surface as the vocabulary entry above: precedence must pick the word.
    { id: 4, item_type: 'kanji', primary_form: '来る', slug: 'kanji-kuru-dupe' },
    { id: 5, item_type: 'grammar', primary_form: '〜てください', slug: 'te-kudasai' },
  ]);
  __mockSetExampleSentences(DB_NAME, [
    { id: 10, item_id: 1, japanese: '朝ご飯を食べました。', english: 'I ate breakfast.' },
  ]);
  __mockSetExampleSentenceSpans(DB_NAME, [
    // 食べました at offsets 4–9 of the sentence above.
    { id: 100, sentence_id: 10, item_id: 1, start_offset: 4, end_offset: 9, inflection: 'masu' },
    // A dictionary-form span (朝ご飯) — carries no inflection, so the surface
    // layer must skip it.
    { id: 101, sentence_id: 10, item_id: 9, start_offset: 0, end_offset: 3, inflection: null },
  ]);
  __mockSetReadingPassages(DB_NAME, [{ id: 20, jlpt_level: 'N5', body: '猫が来ました。' }]);
  __mockSetPassageWordSpans(DB_NAME, [
    { id: 200, passage_id: 20, vocabulary_item_id: 2, start_offset: 2, end_offset: 6, inflection: 'masu' },
  ]);
}

describe('getChatWordIndex (15.1)', () => {
  beforeEach(() => {
    __mockResetSqlite();
    seed();
  });

  it('indexes dictionary forms, vocabulary winning a shared surface', async () => {
    const db = await openCurriculum();
    const index = getChatWordIndex(db);

    expect(index.get('食べる')).toEqual({ itemId: '1', inflection: null });
    expect(index.get('食')).toEqual({ itemId: '3', inflection: null });
    // Item 4 is a kanji with the same primary_form; the vocabulary item wins.
    expect(index.get('来る')).toEqual({ itemId: '2', inflection: null });
    expect(index.get('〜てください')).toEqual({ itemId: '5', inflection: null });
  });

  it('indexes taught-inflection surfaces from example sentences and passages', async () => {
    const db = await openCurriculum();
    const index = getChatWordIndex(db);

    expect(index.get('食べました')).toEqual({ itemId: '1', inflection: 'masu' });
    expect(index.get('来ました')).toEqual({ itemId: '2', inflection: 'masu' });
  });

  it('ignores dictionary-form spans — those are already in the first layer', async () => {
    const db = await openCurriculum();
    const index = getChatWordIndex(db);

    // Span 101 covers 朝ご飯 with no inflection: it points at an item that is not
    // in `items` at all, and must not leak a link in on the strength of a span.
    expect(index.get('朝ご飯')).toBeUndefined();
  });

  it('caches per curriculum handle', async () => {
    const db = await openCurriculum();
    const first = getChatWordIndex(db);

    __mockSetItems(DB_NAME, []);

    expect(getChatWordIndex(db)).toBe(first);
  });

  it('falls back to dictionary forms only when the spans tables are missing', async () => {
    __mockResetSqlite();
    __mockSetItems(DB_NAME, [
      { id: 1, item_type: 'vocabulary', primary_form: '食べる', slug: 'taberu-v' },
    ]);

    const db = await openCurriculum();
    const index = getChatWordIndex(db);

    expect(index.get('食べる')).toEqual({ itemId: '1', inflection: null });
    expect(index.get('食べました')).toBeUndefined();
  });
});
