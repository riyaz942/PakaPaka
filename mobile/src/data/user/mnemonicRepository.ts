import type { SQLiteDatabase } from 'expo-sqlite';

function parseItemId(itemId: string): number {
  const parsed = Number(itemId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid item id: ${itemId}`);
  }
  return parsed;
}

export function getPersonalMnemonic(
  userDb: SQLiteDatabase,
  itemId: string,
): string | null {
  const row = userDb.getFirstSync<{ mnemonic_text: string }>(
    'SELECT mnemonic_text FROM personal_mnemonics WHERE item_id = ?',
    parseItemId(itemId),
  );
  return row?.mnemonic_text ?? null;
}

export function clearPersonalMnemonic(userDb: SQLiteDatabase, itemId: string): void {
  userDb.runSync('DELETE FROM personal_mnemonics WHERE item_id = ?', parseItemId(itemId));
}

export function setPersonalMnemonic(
  userDb: SQLiteDatabase,
  itemId: string,
  text: string,
): void {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    clearPersonalMnemonic(userDb, itemId);
    return;
  }
  const updatedAt = new Date().toISOString();
  userDb.runSync(
    `INSERT INTO personal_mnemonics (item_id, mnemonic_text, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET mnemonic_text = excluded.mnemonic_text, updated_at = excluded.updated_at`,
    parseItemId(itemId),
    trimmed,
    updatedAt,
  );
}
