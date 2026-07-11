import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError, Result } from '@/types/result.types';

export type UserSynonym = {
  itemId: string;
  answerType: 'meaning' | 'reading';
  answerText: string;
};

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

/** Batched read mirroring getBoosts — one query for the whole queue. */
export function listSynonymsForItems(
  userDb: SQLiteDatabase,
  itemIds: string[],
): Map<string, UserSynonym[]> {
  const result = new Map<string, UserSynonym[]>();
  if (itemIds.length === 0) return result;

  const numericIds = itemIds.map((id) => parseItemId(id));
  const placeholders = numericIds.map(() => '?').join(', ');

  const rows = userDb.getAllSync<{
    item_id: number | string;
    answer_type: 'meaning' | 'reading';
    answer_text: string;
  }>(
    `SELECT item_id, answer_type, answer_text FROM user_synonyms WHERE item_id IN (${placeholders})`,
    ...numericIds,
  );

  for (const row of rows) {
    const itemId = String(row.item_id);
    const synonyms = result.get(itemId) ?? [];
    synonyms.push({ itemId, answerType: row.answer_type, answerText: row.answer_text });
    result.set(itemId, synonyms);
  }

  return result;
}

export function listSynonymsForItem(
  userDb: SQLiteDatabase,
  itemId: string,
): UserSynonym[] {
  return listSynonymsForItems(userDb, [itemId]).get(itemId) ?? [];
}

export function addSynonym(
  userDb: SQLiteDatabase,
  itemId: string,
  answerType: 'meaning' | 'reading',
  answerText: string,
): Result<void, AppError> {
  const trimmed = answerText.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: { code: 'synonym_empty', message: 'Cannot add an empty answer' },
    };
  }

  try {
    userDb.runSync(
      `INSERT INTO user_synonyms (item_id, answer_type, answer_text, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id, answer_type, answer_text) DO NOTHING`,
      parseItemId(itemId),
      answerType,
      trimmed,
      new Date().toISOString(),
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'synonym_add_failed',
        message: 'Failed to save your answer',
        cause,
      },
    };
  }
}

export function removeSynonym(
  userDb: SQLiteDatabase,
  itemId: string,
  answerType: 'meaning' | 'reading',
  answerText: string,
): Result<void, AppError> {
  try {
    userDb.runSync(
      'DELETE FROM user_synonyms WHERE item_id = ? AND answer_type = ? AND answer_text = ?',
      parseItemId(itemId),
      answerType,
      answerText,
    );
    return { ok: true, value: undefined };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: 'synonym_remove_failed',
        message: 'Failed to remove your answer',
        cause,
      },
    };
  }
}
