import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { itemRefKey } from '@/core/backup/slugResolver';
import { mergeRows } from '@/core/sync/mergeRows';
import {
  mergeAppendOnly,
  mergeBoosts,
  mergeCognitiveLoad,
  mergeDailyLessonLog,
  mergePassageResults,
  mergePreferences,
  mergeSingleton,
  mergeStreak,
} from '@/core/sync/mergeSpecial';
import {
  SYNC_TABLE_KEYS,
  type CarriedKeys,
  type ConflictChoice,
  type ConflictEntry,
  type KnownContent,
  type SyncTableKey,
} from '@/core/sync/sync.types';
import {
  isKnownRow,
  itemKeyOf,
  itemOf,
  rowKey,
  SYNC_TABLES,
  type SyncRow,
} from '@/core/sync/syncTables';

const PER_ITEM_TABLES = SYNC_TABLE_KEYS.filter((table) => SYNC_TABLES[table].kind === 'per_item');

const PROGRESS_TABLES: readonly SyncTableKey[] = [
  'srsStates',
  'itemStudyStatus',
  'personalMnemonics',
  'userSynonyms',
  'grammarAnswers',
  'passagePracticeResults',
  'dailyLessonLog',
  'cognitiveLoadHistory',
  'lessonOptIns',
];

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** Rows sorted by `rowKey`, in the order `mergeRows` uses. */
function sortByKey<K extends SyncTableKey>(table: K, rows: SyncRow<K>[]): BackupData[K] {
  return rows
    .map((row) => ({ key: rowKey(table, row), row }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ row }) => row) as BackupData[K];
}

/**
 * The keys of `baseData` rows that `user.db` does not hold: rows for content this device does not
 * know, and rows absent from `deviceData` (what `user.db` holds once the base is written).
 */
export function carriedKeysOf(
  baseData: BackupData,
  deviceData: BackupData,
  known: KnownContent,
): CarriedKeys {
  const carried: CarriedKeys = {};
  for (const table of SYNC_TABLE_KEYS) {
    const deviceKeys = new Set(deviceData[table].map((row) => rowKey(table, row)));
    const keys = (baseData[table] as SyncRow<SyncTableKey>[])
      .filter((row) => !isKnownRow(table, row, known) || !deviceKeys.has(rowKey(table, row)))
      .map((row) => rowKey(table, row))
      .sort();
    if (keys.length > 0) carried[table] = keys;
  }
  return carried;
}

/**
 * `local` plus the base rows `user.db` does not hold: rows for content this device does not know,
 * and rows listed in `carried` (for example an item a curriculum update has made known since).
 * Any other base row that `local` lacks was deleted on this device and stays deleted.
 */
export function withCarriedRows(
  local: BackupData,
  base: BackupData | null,
  known: KnownContent,
  carried: CarriedKeys,
): BackupData {
  if (base === null) return local;
  const result = { ...local };
  for (const table of SYNC_TABLE_KEYS) {
    const localKeys = new Set(local[table].map((row) => rowKey(table, row)));
    const carriedKeys = new Set(carried[table] ?? []);
    const rows = (base[table] as SyncRow<SyncTableKey>[]).filter((row) => {
      const key = rowKey(table, row);
      return !localKeys.has(key) && (!isKnownRow(table, row, known) || carriedKeys.has(key));
    });
    if (rows.length === 0) continue;
    (result as Record<SyncTableKey, unknown>)[table] = sortByKey(table, [
      ...(local[table] as SyncRow<SyncTableKey>[]),
      ...rows,
    ]);
  }
  return result;
}

/** True when the device has no study progress (settings and seen cards do not count). */
export function isEmptyProgress(data: BackupData): boolean {
  return PROGRESS_TABLES.every((table) => data[table].length === 0);
}

/** The time of a per-item row: `updatedAt`, or `createdAt` / `optedInAt` for tables without it. */
function rowTime(row: object): string {
  const { updatedAt, createdAt, optedInAt } = row as Record<string, string | undefined>;
  return (updatedAt ?? createdAt ?? optedInAt) as string;
}

/** Item key → the latest time among that item's per-item rows. */
function latestTimeByItem(data: BackupData): Map<string, string> {
  const times = new Map<string, string>();
  for (const table of PER_ITEM_TABLES) {
    for (const row of data[table]) {
      const key = itemKeyOf(table, row) as string;
      const time = rowTime(row);
      const current = times.get(key);
      if (current === undefined || time > current) times.set(key, time);
    }
  }
  return times;
}

/**
 * Three-way merge of two sync files. Per-item tables group by item: one conflicting row puts the
 * whole item in one entry, and with a choice every per-item row of that item comes from the chosen
 * side. Preference conflicts follow the same choice per key. Every other table has its own rule and
 * never follows the choice. `local` must already include carried rows (`withCarriedRows`).
 */
export function mergeSyncData(
  input: { base: BackupData | null; local: BackupData; remote: BackupData },
  choice: ConflictChoice | null,
): { conflicts: ConflictEntry[]; merged: BackupData | null } {
  const { base, local, remote } = input;

  const perItem = PER_ITEM_TABLES.map((table) => ({
    table,
    entries: mergeRows(table, base?.[table] ?? null, local[table], remote[table]),
  }));
  const conflictItems = new Map<string, ItemRef>();
  for (const { table, entries } of perItem) {
    for (const entry of entries) {
      if (entry.decision !== 'conflict') continue;
      const ref = itemOf(table, (entry.local ?? entry.remote) as SyncRow<SyncTableKey>) as ItemRef;
      conflictItems.set(itemRefKey(ref), ref);
    }
  }
  const preferences = mergePreferences(
    base?.userPreferences ?? null,
    local.userPreferences,
    remote.userPreferences,
  );

  const localTimes = latestTimeByItem(local);
  const remoteTimes = latestTimeByItem(remote);
  const conflicts: ConflictEntry[] = [
    ...[...conflictItems.keys()].sort().map((key): ConflictEntry => ({
      kind: 'item',
      item: conflictItems.get(key) as ItemRef,
      localUpdatedAt: localTimes.get(key) ?? null,
      remoteUpdatedAt: remoteTimes.get(key) ?? null,
    })),
    ...preferences.conflicts.map((conflict): ConflictEntry => ({
      kind: 'preference',
      key: conflict.key,
      localUpdatedAt: conflict.local?.updatedAt ?? null,
      remoteUpdatedAt: conflict.remote?.updatedAt ?? null,
    })),
  ];
  if (choice === null && conflicts.length > 0) return { conflicts, merged: null };

  // With no choice there is no conflict, so `choice !== null` holds wherever a conflict is resolved.
  // Every sync table is replaced below.
  const merged: BackupData = { ...local, aiSessions: [], aiMessages: [] };
  for (const { table, entries } of perItem) {
    (merged as Record<SyncTableKey, unknown>)[table] = entries
      .map((entry) => {
        const row = (entry.base ?? entry.local ?? entry.remote) as SyncRow<SyncTableKey>;
        if (choice !== null && conflictItems.has(itemKeyOf(table, row) as string)) {
          return entry[choice];
        }
        return entry.decision === 'take_remote' ? entry.remote : entry.local;
      })
      .filter(isDefined);
  }
  merged.userPreferences = sortByKey('userPreferences', [
    ...preferences.rows,
    ...preferences.conflicts
      .map((conflict) => (choice === null ? undefined : conflict[choice]))
      .filter(isDefined),
  ]);

  const baseOf = <K extends SyncTableKey>(table: K): BackupData[K] | null => base?.[table] ?? null;
  merged.relatedItemBoosts = mergeBoosts(
    baseOf('relatedItemBoosts'),
    local.relatedItemBoosts,
    remote.relatedItemBoosts,
  );
  merged.cardSeen = mergeAppendOnly(
    'cardSeen',
    baseOf('cardSeen'),
    local.cardSeen,
    remote.cardSeen,
  );
  merged.importMetadata = mergeAppendOnly(
    'importMetadata',
    baseOf('importMetadata'),
    local.importMetadata,
    remote.importMetadata,
  );
  merged.passagePracticeResults = mergePassageResults(
    baseOf('passagePracticeResults'),
    local.passagePracticeResults,
    remote.passagePracticeResults,
  );
  merged.dailyLessonLog = mergeDailyLessonLog(
    baseOf('dailyLessonLog'),
    local.dailyLessonLog,
    remote.dailyLessonLog,
  );
  merged.cognitiveLoadHistory = mergeCognitiveLoad(
    baseOf('cognitiveLoadHistory'),
    local.cognitiveLoadHistory,
    remote.cognitiveLoadHistory,
  );
  merged.goalRingState = mergeSingleton(
    'goalRingState',
    baseOf('goalRingState'),
    local.goalRingState,
    remote.goalRingState,
  );
  merged.streaks = mergeStreak(local.streaks, remote.streaks, merged.cognitiveLoadHistory);

  return { conflicts, merged };
}
