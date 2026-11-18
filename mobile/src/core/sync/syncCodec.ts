import * as pako from 'pako';

import {
  BACKUP_DATA_KEYS,
  type BackupBundle,
  type BackupData,
  type BackupEnvelopeInput,
} from '@/core/backup/backup.types';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  parseBackupBundle,
} from '@/core/backup/backupSerializer';
import { toSyncData, validateSyncData } from '@/core/sync/syncFile';
import { syncError } from '@/core/sync/syncMessages';
import type { AppError, Result } from '@/types/result.types';

const ROWS_PER_CHUNK = 500;
const INFLATE_SLICE_BYTES = 64 * 1024;

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The sync file as gzip bytes. The text is byte-for-byte what
 * `serializeBackupBundle` gives for the same bundle, but it is written in
 * pieces so the JS thread gets a turn between chunks.
 */
export async function encodeSyncFile(
  envelope: Pick<BackupEnvelopeInput, 'schemaVersion' | 'curriculumVersion' | 'exportedAt'>,
  data: BackupData,
): Promise<Uint8Array> {
  const syncData = toSyncData(data);
  const deflate = new pako.Deflate({ gzip: true });

  deflate.push(
    `{"format":${JSON.stringify(BACKUP_FORMAT)},"formatVersion":${BACKUP_FORMAT_VERSION}` +
      `,"schemaVersion":${JSON.stringify(envelope.schemaVersion)}` +
      `,"curriculumVersion":${JSON.stringify(envelope.curriculumVersion)}` +
      `,"exportedAt":${JSON.stringify(envelope.exportedAt)}` +
      `,"includesConversations":false,"data":{`,
    false,
  );

  for (const [tableIndex, table] of BACKUP_DATA_KEYS.entries()) {
    const rows = syncData[table] as unknown[];
    deflate.push(`${tableIndex === 0 ? '' : ','}${JSON.stringify(table)}:[`, false);
    for (let start = 0; start < rows.length; start += ROWS_PER_CHUNK) {
      // JSON.stringify of a slice is `[a,b]`; drop the brackets to splice it into the table list.
      const chunk = JSON.stringify(rows.slice(start, start + ROWS_PER_CHUNK)).slice(1, -1);
      deflate.push(start === 0 ? chunk : `,${chunk}`, false);
      await yieldToUi();
    }
    deflate.push(']', false);
  }

  deflate.push('}}', true);
  return deflate.result as Uint8Array;
}

/** Reads a sync file. Any damage is `sync_bad_file`; a newer format is `sync_update_required`. */
export async function decodeSyncFile(bytes: Uint8Array): Promise<Result<BackupBundle, AppError>> {
  const inflate = new pako.Inflate({ to: 'string' });
  if (bytes.length === 0) {
    return { ok: false, error: syncError('sync_bad_file', 'Empty file') };
  }
  for (let start = 0; start < bytes.length; start += INFLATE_SLICE_BYTES) {
    const end = Math.min(start + INFLATE_SLICE_BYTES, bytes.length);
    inflate.push(bytes.subarray(start, end), end === bytes.length);
    if (inflate.err) {
      return { ok: false, error: syncError('sync_bad_file', inflate.msg) };
    }
    await yieldToUi();
  }

  const parsed = parseBackupBundle(inflate.result as string);
  if (!parsed.ok) {
    const code =
      parsed.error.code === 'BACKUP_VERSION_UNSUPPORTED' ? 'sync_update_required' : 'sync_bad_file';
    return { ok: false, error: syncError(code, parsed.error) };
  }

  const validated = validateSyncData(parsed.value.data);
  if (!validated.ok) return validated;

  return { ok: true, value: { ...parsed.value, data: toSyncData(validated.value) } };
}
