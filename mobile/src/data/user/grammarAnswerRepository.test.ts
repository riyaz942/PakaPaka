import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration021GrammarAnswers } from '@/data/migrations/021_grammar_answers';
import {
  addGrammarAnswer,
  getGrammarSentenceHistory,
  listGrammarAnswers,
  setGrammarSentenceHistory,
} from '@/data/user/grammarAnswerRepository';

async function userDb() {
  const db = await openDatabaseAsync('user.db');
  migration021GrammarAnswers.up(db);
  return db;
}

describe('grammarAnswerRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('groups saved answers by sentence and ignores a duplicate', async () => {
    const db = await userDb();
    expect(addGrammarAnswer(db, '7', 'S1', 'a1').ok).toBe(true);
    expect(addGrammarAnswer(db, '7', 'S1', 'a1').ok).toBe(true);
    expect(addGrammarAnswer(db, '7', 'S2', 'a2').ok).toBe(true);
    expect(addGrammarAnswer(db, '8', 'S1', 'other item').ok).toBe(true);

    const answers = listGrammarAnswers(db, '7');
    expect(answers.get('S1')).toEqual(['a1']);
    expect(answers.get('S2')).toEqual(['a2']);
  });

  it('returns [] before any review and the last saved keys after', async () => {
    const db = await userDb();
    expect(getGrammarSentenceHistory(db, '7')).toEqual([]);

    expect(setGrammarSentenceHistory(db, '7', ['S1', 'S2']).ok).toBe(true);
    expect(setGrammarSentenceHistory(db, '7', ['S3', 'S4']).ok).toBe(true);

    expect(getGrammarSentenceHistory(db, '7')).toEqual(['S3', 'S4']);
  });
});
