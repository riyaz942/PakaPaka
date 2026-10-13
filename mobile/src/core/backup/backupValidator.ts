import { BACKUP_DATA_KEYS, type BackupData } from '@/core/backup/backup.types';
import type { AppError, Result } from '@/types/result.types';

/**
 * Tables whose rows are keyed by a curriculum item — `parseBackupBundle` only
 * proves each of these is an array (9.1 deferral), so a row missing its `item`
 * ref would otherwise reach the restore transaction and INSERT a NULL id.
 */
const ITEM_KEYED_KEYS: readonly (keyof BackupData)[] = [
  'itemStudyStatus',
  'srsStates',
  'personalMnemonics',
  'relatedItemBoosts',
  'weaknessStats',
  'userSynonyms',
  'furiganaOverrides',
  'grammarAnswers',
  'grammarSentenceHistory',
];

function invalidShape(message: string): Result<BackupData, AppError> {
  return {
    ok: false,
    error: {
      code: 'BACKUP_INVALID_SHAPE',
      message,
      userMessage: 'This backup file is damaged and cannot be restored.',
    },
  };
}

function isItemRef(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Record<string, unknown>;
  return typeof ref.itemType === 'string' && typeof ref.slug === 'string';
}

function isValidAiSessionRow(row: Record<string, unknown>): boolean {
  if (row.topicItem != null && !isItemRef(row.topicItem)) return false;
  if (!Array.isArray(row.topicItems) || !row.topicItems.every(isItemRef)) return false;
  return true;
}

/**
 * Row-level shape check, run after `parseBackupBundle`'s envelope check and
 * before anything is written. Unknown keys in `data` are left alone so a file
 * from a newer app version still restores its known tables (AC4).
 */
export function validateBackupData(data: BackupData): Result<BackupData, AppError> {
  for (const key of BACKUP_DATA_KEYS) {
    const rows = data[key] as unknown[];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return invalidShape(`Invalid row in ${key} at index ${index}`);
      }
      if (ITEM_KEYED_KEYS.includes(key) && !isItemRef((row as Record<string, unknown>).item)) {
        return invalidShape(`Missing item reference in ${key} at index ${index}`);
      }
      if (key === 'aiSessions' && !isValidAiSessionRow(row as Record<string, unknown>)) {
        return invalidShape(`Invalid topic item reference in aiSessions at index ${index}`);
      }
    }
  }

  return { ok: true, value: data };
}
