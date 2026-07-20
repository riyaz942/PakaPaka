import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetExampleSentences,
  __mockSetItems,
  __mockSetSrsStates,
} from '../../../__mocks__/expo-sqlite';

import { getGreetingSentence } from './greetingRepository';

import type { SQLiteDatabase } from 'expo-sqlite';

let curriculumDb: SQLiteDatabase;
let userDb: SQLiteDatabase;

function srsRow(itemId: number, stage: string) {
  return {
    item_id: itemId,
    stability: 5,
    difficulty: 5,
    due_date: '2026-07-21T00:00:00.000Z',
    fsrs_state: 'review',
    reps: 3,
    lapses: 0,
    is_burned: stage === 'burned' ? 1 : 0,
    srs_stage_label: stage,
    updated_at: '2026-07-19T00:00:00.000Z',
  };
}

beforeEach(async () => {
  __mockResetSqlite();
  curriculumDb = (await openDatabaseAsync('curriculum.db')) as unknown as SQLiteDatabase;
  userDb = (await openDatabaseAsync('user.db')) as unknown as SQLiteDatabase;
});

describe('getGreetingSentence', () => {
  it('returns null when no items are started (day 1)', () => {
    expect(getGreetingSentence(curriculumDb, userDb)).toBeNull();
  });

  it('returns null when started items have no example sentences', () => {
    __mockSetItems('curriculum.db', [
      { id: 1, item_type: 'vocabulary', primary_form: '猫', meaning: 'cat' },
    ]);
    __mockSetSrsStates('user.db', [srsRow(1, 'apprentice')]);

    expect(getGreetingSentence(curriculumDb, userDb)).toBeNull();
  });

  it('prefers a Guru+ vocabulary sentence over an apprentice one', () => {
    __mockSetItems('curriculum.db', [
      { id: 1, item_type: 'vocabulary', primary_form: '猫', meaning: 'cat' },
      { id: 2, item_type: 'vocabulary', primary_form: '犬', meaning: 'dog' },
    ]);
    __mockSetExampleSentences('curriculum.db', [
      { id: 10, item_id: 1, japanese: '猫がいます。', furigana: null, english: 'There is a cat.', sort_order: 0 },
      { id: 11, item_id: 2, japanese: '犬がいます。', furigana: null, english: 'There is a dog.', sort_order: 0 },
    ]);
    __mockSetSrsStates('user.db', [srsRow(1, 'apprentice'), srsRow(2, 'guru')]);

    expect(getGreetingSentence(curriculumDb, userDb)).toBe('犬がいます。');
  });

  it('falls back to an apprentice vocabulary sentence when no Guru+ item has one', () => {
    __mockSetItems('curriculum.db', [
      { id: 1, item_type: 'vocabulary', primary_form: '猫', meaning: 'cat' },
      { id: 2, item_type: 'kanji', primary_form: '犬', meaning: 'dog' },
    ]);
    __mockSetExampleSentences('curriculum.db', [
      { id: 10, item_id: 1, japanese: '猫がいます。', furigana: null, english: 'There is a cat.', sort_order: 0 },
    ]);
    __mockSetSrsStates('user.db', [srsRow(1, 'apprentice'), srsRow(2, 'guru')]);

    expect(getGreetingSentence(curriculumDb, userDb)).toBe('猫がいます。');
  });

  it('skips non-vocabulary items even at Guru+', () => {
    __mockSetItems('curriculum.db', [
      { id: 2, item_type: 'kanji', primary_form: '犬', meaning: 'dog' },
    ]);
    __mockSetExampleSentences('curriculum.db', [
      { id: 11, item_id: 2, japanese: '犬がいます。', furigana: null, english: 'There is a dog.', sort_order: 0 },
    ]);
    __mockSetSrsStates('user.db', [srsRow(2, 'guru')]);

    expect(getGreetingSentence(curriculumDb, userDb)).toBeNull();
  });
});
