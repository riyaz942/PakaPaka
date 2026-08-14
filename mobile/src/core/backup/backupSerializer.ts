import {
  BACKUP_DATA_KEYS,
  type BackupBundle,
  type BackupData,
  type BackupEnvelopeInput,
} from '@/core/backup/backup.types';
import type { AppError, Result } from '@/types/result.types';

export const BACKUP_FORMAT = 'kizamu-backup';
export const BACKUP_FORMAT_VERSION = 1;

export function buildBackupBundle(envelope: BackupEnvelopeInput, data: BackupData): BackupBundle {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: envelope.schemaVersion,
    curriculumVersion: envelope.curriculumVersion,
    exportedAt: envelope.exportedAt,
    includesConversations: envelope.includesConversations,
    data,
  };
}

export function serializeBackupBundle(bundle: BackupBundle): string {
  return JSON.stringify(bundle);
}

function invalidShape(message: string): Result<BackupBundle, AppError> {
  return { ok: false, error: { code: 'BACKUP_INVALID_SHAPE', message } };
}

export function parseBackupBundle(rawJson: string): Result<BackupBundle, AppError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (cause) {
    return {
      ok: false,
      error: { code: 'BACKUP_INVALID_JSON', message: 'Backup file is not valid JSON', cause },
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return invalidShape('Backup file is not an object');
  }
  const record = parsed as Record<string, unknown>;

  if (record.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: {
        code: 'BACKUP_FORMAT_MISMATCH',
        message: `Unrecognized backup format: ${String(record.format)}`,
      },
    };
  }
  if (record.formatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error: {
        code: 'BACKUP_VERSION_UNSUPPORTED',
        message: `Unsupported backup formatVersion: ${String(record.formatVersion)}`,
      },
    };
  }
  if (typeof record.schemaVersion !== 'number') {
    return invalidShape('Missing or invalid schemaVersion');
  }
  if (typeof record.exportedAt !== 'string') {
    return invalidShape('Missing or invalid exportedAt');
  }
  if (typeof record.includesConversations !== 'boolean') {
    return invalidShape('Missing or invalid includesConversations');
  }
  if (!record.data || typeof record.data !== 'object') {
    return invalidShape('Missing data object');
  }

  const data = record.data as Record<string, unknown>;
  for (const key of BACKUP_DATA_KEYS) {
    if (!Array.isArray(data[key])) {
      return invalidShape(`Missing or invalid table: ${key}`);
    }
  }

  return {
    ok: true,
    value: {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: record.schemaVersion,
      curriculumVersion:
        typeof record.curriculumVersion === 'string' ? record.curriculumVersion : null,
      exportedAt: record.exportedAt,
      includesConversations: record.includesConversations,
      data: data as unknown as BackupData,
    },
  };
}
