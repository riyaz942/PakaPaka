import type { BackupData } from "@/core/backup/backup.types";
import type { SyncTableKey } from "@/core/sync/sync.types";
import { rowKey, rowsEqual, type SyncRow } from "@/core/sync/syncTables";

export type RowDecision =
  "unchanged" | "take_remote" | "keep_local" | "same_change" | "conflict";

export type RowMerge<K extends SyncTableKey> = {
  key: string;
  decision: RowDecision;
  base?: SyncRow<K>;
  local?: SyncRow<K>;
  remote?: SyncRow<K>;
};

function indexByKey<K extends SyncTableKey>(
  table: K,
  rows: readonly SyncRow<K>[],
): Map<string, SyncRow<K>> {
  return new Map(rows.map((row) => [rowKey(table, row), row]));
}

/**
 * Three-way compare of one table by row content (never `updatedAt`).
 * A missing row is a value. `base === null` means every base row is missing.
 */
export function mergeRows<K extends SyncTableKey>(
  table: K,
  base: BackupData[K] | null,
  local: BackupData[K],
  remote: BackupData[K],
): RowMerge<K>[] {
  const baseRows = indexByKey(table, base ?? []);
  const localRows = indexByKey(table, local);
  const remoteRows = indexByKey(table, remote);
  const keys = [
    ...new Set([...baseRows.keys(), ...localRows.keys(), ...remoteRows.keys()]),
  ].sort();

  return keys.map((key) => {
    const baseRow = baseRows.get(key);
    const localRow = localRows.get(key);
    const remoteRow = remoteRows.get(key);
    const localChanged = !rowsEqual(table, localRow, baseRow);
    const remoteChanged = !rowsEqual(table, remoteRow, baseRow);

    let decision: RowDecision;
    if (!localChanged && !remoteChanged) decision = "unchanged";
    else if (!localChanged) decision = "take_remote";
    else if (!remoteChanged) decision = "keep_local";
    else if (rowsEqual(table, localRow, remoteRow)) decision = "same_change";
    else decision = "conflict";

    return { key, decision, base: baseRow, local: localRow, remote: remoteRow };
  });
}
