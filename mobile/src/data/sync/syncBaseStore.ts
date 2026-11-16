import type { BackupData } from '@/core/backup/backup.types';
import type { CarriedKeys } from '@/core/sync/sync.types';
import { syncError } from '@/core/sync/syncMessages';
import type { SyncSql } from '@/data/sync/syncTransaction';
import type { AppError, Result } from '@/types/result.types';

export type SyncBase = {
  revision: number;
  data: BackupData;
  pendingReplace: boolean;
  carried: CarriedKeys;
};

export type SyncStatusRow = { lastSyncedAt: string | null; lastErrorCode: string | null };

async function attempt<T>(task: () => Promise<T>): Promise<Result<T, AppError>> {
  try {
    return { ok: true, value: await task() };
  } catch (cause) {
    return { ok: false, error: syncError('sync_local_failed', cause) };
  }
}

/** NULL when there are no carried keys. */
function carriedJson(carried: CarriedKeys): string | null {
  return Object.keys(carried).length > 0 ? JSON.stringify(carried) : null;
}

/** The base copy; `null` when there is none (no row, or `data_json` is NULL). */
export function readSyncBase(db: SyncSql): Promise<Result<SyncBase | null, AppError>> {
  return attempt(async () => {
    const row = await db.getFirstAsync<{
      revision: number;
      data_json: string | null;
      pending_replace: number;
      carried_keys_json: string | null;
    }>('SELECT revision, data_json, pending_replace, carried_keys_json FROM sync_base WHERE id = 1');
    if (!row || row.data_json === null) return null;
    return {
      revision: row.revision,
      data: JSON.parse(row.data_json) as BackupData,
      pendingReplace: row.pending_replace === 1,
      carried: row.carried_keys_json === null ? {} : (JSON.parse(row.carried_keys_json) as CarriedKeys),
    };
  });
}

/**
 * Stores a new base and clears `pending_replace` and the last error. `syncedAt === null` keeps
 * `last_synced_at`. Throws on failure: it runs inside the apply transaction.
 */
export async function writeSyncBase(
  sql: SyncSql,
  base: { revision: number; data: BackupData; carried: CarriedKeys },
  syncedAt: string | null,
): Promise<void> {
  await sql.runAsync(
    `INSERT INTO sync_base
       (id, revision, data_json, carried_keys_json, pending_replace, last_synced_at, last_error_code)
     VALUES (1, ?, ?, ?, 0, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       revision = excluded.revision,
       data_json = excluded.data_json,
       carried_keys_json = excluded.carried_keys_json,
       pending_replace = 0,
       last_synced_at = COALESCE(excluded.last_synced_at, sync_base.last_synced_at),
       last_error_code = NULL`,
    base.revision,
    JSON.stringify(base.data),
    carriedJson(base.carried),
    syncedAt,
  );
}

/** Stores `data` as the base to push as a replace; keeps the revision (0 with no row). */
export function markPendingReplace(
  db: SyncSql,
  data: BackupData,
  carried: CarriedKeys,
): Promise<Result<void, AppError>> {
  return attempt(async () => {
    await db.runAsync(
      `INSERT INTO sync_base (id, revision, data_json, carried_keys_json, pending_replace)
       VALUES (1, 0, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         data_json = excluded.data_json,
         carried_keys_json = excluded.carried_keys_json,
         pending_replace = 1`,
      JSON.stringify(data),
      carriedJson(carried),
    );
  });
}

export function readSyncStatus(db: SyncSql): Promise<Result<SyncStatusRow, AppError>> {
  return attempt(async () => {
    const row = await db.getFirstAsync<{ last_synced_at: string | null; last_error_code: string | null }>(
      'SELECT last_synced_at, last_error_code FROM sync_base WHERE id = 1',
    );
    return { lastSyncedAt: row?.last_synced_at ?? null, lastErrorCode: row?.last_error_code ?? null };
  });
}

export function writeSyncError(db: SyncSql, code: string | null): Promise<Result<void, AppError>> {
  return attempt(async () => {
    await db.runAsync(
      `INSERT INTO sync_base (id, last_error_code) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET last_error_code = excluded.last_error_code`,
      code,
    );
  });
}

export function clearSyncBase(db: SyncSql): Promise<Result<void, AppError>> {
  return attempt(async () => {
    await db.runAsync('DELETE FROM sync_base');
  });
}
