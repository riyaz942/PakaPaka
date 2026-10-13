import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migrations } from '@/data/migrations';
import { migration021GrammarAnswers } from '@/data/migrations/021_grammar_answers';

describe('021_grammar_answers', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('claims version 21 and is registered in version order', () => {
    expect(migration021GrammarAnswers.version).toBe(21);
    expect(migration021GrammarAnswers.name).toBe('021_grammar_answers');
    expect(migrations[20]).toBe(migration021GrammarAnswers);
  });

  it('creates both tables and is idempotent on re-run', async () => {
    const db = await openDatabaseAsync('user.db');

    migration021GrammarAnswers.up(db);
    for (const table of ['user_grammar_answers', 'grammar_sentence_history']) {
      expect(
        db.getAllSync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table),
      ).toHaveLength(1);
    }

    db.runSync(
      `INSERT INTO user_grammar_answers (item_id, sentence_key, answer_text, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, sentence_key, answer_text) DO NOTHING`,
      7,
      '寒いから、コートを着ます。',
      'さむいからこーとをきます',
      'then',
    );
    migration021GrammarAnswers.up(db);
    expect(db.getAllSync('SELECT * FROM user_grammar_answers')).toHaveLength(1);
  });
});
