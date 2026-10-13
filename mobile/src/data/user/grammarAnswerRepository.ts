import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError, Result } from '@/types/result.types';

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

/** Saved Build answers for one grammar item: sentence key → answers. */
export function listGrammarAnswers(userDb: SQLiteDatabase, itemId: string): Map<string, string[]> {
  const rows = userDb.getAllSync<{ sentence_key: string; answer_text: string }>(
    'SELECT sentence_key, answer_text FROM user_grammar_answers WHERE item_id = ?',
    parseItemId(itemId),
  );
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const answers = result.get(row.sentence_key) ?? [];
    answers.push(row.answer_text);
    result.set(row.sentence_key, answers);
  }
  return result;
}

export function addGrammarAnswer(
  userDb: SQLiteDatabase,
  itemId: string,
  sentenceKey: string,
  answerText: string,
): Result<void, AppError> {
  try {
    userDb.runSync(
      `INSERT INTO user_grammar_answers (item_id, sentence_key, answer_text, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, sentence_key, answer_text) DO NOTHING`,
      parseItemId(itemId),
      sentenceKey,
      answerText,
      new Date().toISOString(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'grammar_answer_write_failed', message: 'Failed to save grammar answer', cause },
    };
  }
}

/** The previous review's sentence keys, or [] before the first review. */
export function getGrammarSentenceHistory(userDb: SQLiteDatabase, itemId: string): string[] {
  const row = userDb.getFirstSync<{ sentence_keys: string }>(
    'SELECT sentence_keys FROM grammar_sentence_history WHERE item_id = ?',
    parseItemId(itemId),
  );
  if (!row) return [];
  const parsed: unknown = JSON.parse(row.sentence_keys);
  return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
}

export function setGrammarSentenceHistory(
  userDb: SQLiteDatabase,
  itemId: string,
  sentenceKeys: string[],
): Result<void, AppError> {
  try {
    userDb.runSync(
      `INSERT INTO grammar_sentence_history (item_id, sentence_keys, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET sentence_keys = excluded.sentence_keys, updated_at = excluded.updated_at`,
      parseItemId(itemId),
      JSON.stringify(sentenceKeys),
      new Date().toISOString(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'grammar_history_write_failed', message: 'Failed to save grammar history', cause },
    };
  }
}
