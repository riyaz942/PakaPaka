import type { BackupData } from '@/core/backup/backup.types';
import { validateBackupData } from '@/core/backup/backupValidator';
import { SYNC_TABLE_KEYS } from '@/core/sync/sync.types';
import { syncError } from '@/core/sync/syncMessages';
import { NEVER_SYNCED_PREFERENCE_KEYS, SYNC_TABLES, type FieldType } from '@/core/sync/syncTables';
import type { AppError, Result } from '@/types/result.types';

/** A copy for the wire: device-local preferences and conversations are left out. */
export function toSyncData(data: BackupData): BackupData {
  return {
    ...data,
    userPreferences: data.userPreferences.filter((row) => !NEVER_SYNCED_PREFERENCE_KEYS.has(row.key)),
    aiSessions: [],
    aiMessages: [],
  };
}

function isItemRef(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Record<string, unknown>;
  return typeof ref.itemType === 'string' && typeof ref.slug === 'string';
}

function matchesType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'string|null':
      return value === null || typeof value === 'string';
    case 'number|null':
      return value === null || (typeof value === 'number' && Number.isFinite(value));
    case 'itemRef':
      return isItemRef(value);
    case 'string[]':
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  }
}

/** Shape check for a file that is about to be merged or uploaded. Any failure is `sync_bad_file`. */
export function validateSyncData(data: BackupData): Result<BackupData, AppError> {
  for (const table of SYNC_TABLE_KEYS) {
    if (!Array.isArray(data[table])) {
      return { ok: false, error: syncError('sync_bad_file', `${table} is not a list`) };
    }
  }
  for (const table of ['aiSessions', 'aiMessages'] as const) {
    if (!Array.isArray(data[table])) {
      return { ok: false, error: syncError('sync_bad_file', `${table} is not a list`) };
    }
  }

  const basic = validateBackupData(data);
  if (!basic.ok) return { ok: false, error: syncError('sync_bad_file', basic.error) };

  for (const table of SYNC_TABLE_KEYS) {
    const { fields } = SYNC_TABLES[table];
    const rows = data[table] as unknown as Record<string, unknown>[];
    for (let index = 0; index < rows.length; index += 1) {
      for (const [name, type] of Object.entries(fields)) {
        if (!matchesType(rows[index][name], type)) {
          return {
            ok: false,
            error: syncError('sync_bad_file', `Bad field ${name} in ${table} at index ${index}`),
          };
        }
      }
    }
  }

  return { ok: true, value: data };
}
