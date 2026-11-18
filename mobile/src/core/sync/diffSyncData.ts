import type { BackupData } from '@/core/backup/backup.types';
import { SYNC_TABLE_KEYS, type KnownContent, type SyncTableKey } from '@/core/sync/sync.types';
import { isKnownRow, rowKey, rowsEqual, type SyncRow } from '@/core/sync/syncTables';

export type SyncDiff = {
  [K in SyncTableKey]: { upserts: BackupData[K]; deletes: BackupData[K] };
};

function indexByKey<K extends SyncTableKey>(
  table: K,
  rows: BackupData[K],
): Map<string, SyncRow<K>> {
  return new Map((rows as SyncRow<K>[]).map((row) => [rowKey(table, row), row]));
}

/**
 * The rows to write so a device at `from` becomes `to`. Rows for content this device does not know
 * are left out; a row that differs only in ignored fields (`updatedAt`, …) is not written.
 */
export function diffSyncData(from: BackupData, to: BackupData, known: KnownContent): SyncDiff {
  const diff = {} as Record<SyncTableKey, { upserts: unknown[]; deletes: unknown[] }>;
  for (const table of SYNC_TABLE_KEYS) {
    const fromRows = indexByKey(table, from[table]);
    const toRows = indexByKey(table, to[table]);
    diff[table] = {
      upserts: [...toRows]
        .filter(
          ([key, row]) =>
            isKnownRow(table, row, known) && !rowsEqual(table, fromRows.get(key), row),
        )
        .map(([, row]) => row),
      deletes: [...fromRows]
        .filter(([key, row]) => isKnownRow(table, row, known) && !toRows.has(key))
        .map(([, row]) => row),
    };
  }
  return diff as SyncDiff;
}

/** True when every sync table has the same keys and the same rows (ignored fields aside). */
export function sameSyncData(a: BackupData, b: BackupData): boolean {
  return SYNC_TABLE_KEYS.every((table) => {
    const left = indexByKey(table, a[table]);
    const right = indexByKey(table, b[table]);
    if (left.size !== right.size) return false;
    return [...right].every(([key, row]) => rowsEqual(table, left.get(key), row));
  });
}
