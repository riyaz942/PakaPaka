import type { Migration } from '@/data/migrations/migrations.types';

/**
 * Grammar Read + Build cards (spec §5.1). A sentence is keyed by its plain
 * Japanese, not by `example_sentences.id`: compile assigns those ids in insert
 * order, so they move whenever a curriculum update adds or removes a sentence.
 *
 * - `user_grammar_answers`: Build answers the learner marked "My answer is
 *   correct too", normalised (buildEvaluator.normalizeBuildText).
 * - `grammar_sentence_history`: the last review's two sentence keys (JSON), so
 *   the next review uses different ones (D9).
 */
export const migration021GrammarAnswers: Migration = {
  version: 21,
  name: '021_grammar_answers',
  up: (db) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS user_grammar_answers (
        item_id INTEGER NOT NULL,
        sentence_key TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (item_id, sentence_key, answer_text)
      );
      CREATE TABLE IF NOT EXISTS grammar_sentence_history (
        item_id INTEGER PRIMARY KEY,
        sentence_keys TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
};
