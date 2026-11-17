import type { BackupData } from '@/core/backup/backup.types';
import { diffSyncData, sameSyncData } from '@/core/sync/diffSyncData';
import {
  carriedKeysOf,
  guardedKeysOf,
  isEmptyProgress,
  mergeSyncData,
  withCarriedRows,
  withoutKeys,
} from '@/core/sync/mergeSyncData';
import {
  SYNC_TABLE_KEYS,
  type CarriedKeys,
  type ConflictChoice,
  type ConflictEntry,
  type KnownContent,
} from '@/core/sync/sync.types';
import type { decodeSyncFile, encodeSyncFile } from '@/core/sync/syncCodec';
import { toSyncData, validateSyncData } from '@/core/sync/syncFile';
import { syncError } from '@/core/sync/syncMessages';
import type { SyncApi } from '@/data/sync/syncApi';
import type { SyncBase } from '@/data/sync/syncBaseStore';
import type { CurriculumLookup, SyncSnapshot } from '@/data/sync/syncSnapshot';
import type { AppError, Result } from '@/types/result.types';

export type SyncTrigger = 'open' | 'before_review' | 'session_end' | 'background' | 'manual';

export type SyncRunResult = {
  status: 'skipped' | 'up_to_date' | 'pushed' | 'pulled' | 'merged' | 'deferred' | 'error';
  error: AppError | null;
  changedLocal: boolean;
};

type BaseInput = { revision: number; data: BackupData; carried: CarriedKeys };

export type SyncPorts = {
  isSignedIn(): Promise<boolean>;
  readSnapshot(): Promise<Result<SyncSnapshot>>;
  readBase(): Promise<Result<SyncBase | null>>;
  applyMerge(args: {
    expectedLocal: BackupData;
    merged: BackupData;
    lookup: CurriculumLookup;
    base: BaseInput;
  }): Promise<Result<{ changedRows: number }>>;
  writeBase(base: BaseInput, syncedAt: string): Promise<Result<void>>;
  clearBase(): Promise<Result<void>>;
  writeError(code: string | null): Promise<void>;
  api: SyncApi;
  encode: typeof encodeSyncFile;
  decode: typeof decodeSyncFile;
  /** `null`: no answer (signed out, or the app closed); the run ends and writes nothing. */
  askConflict(entries: ConflictEntry[]): Promise<ConflictChoice | null>;
  isStudyActive(): boolean;
  onPhase(phase: 'idle' | 'syncing' | 'conflict'): void;
  nowIso(): string;
};

const MAX_CYCLES = 3;

/**
 * How a cycle ended: a result for the caller, `retry` to read and pull again (counts as a cycle),
 * or `restart` to read again after the carried rows were written (does not count).
 */
type CycleEnd = { done: SyncRunResult['status'] } | { error: AppError } | 'retry' | 'restart';

/** True when writing `to` over `from` would change a row in user.db. */
function changesDevice(from: BackupData, to: BackupData, known: KnownContent): boolean {
  const diff = diffSyncData(from, to, known);
  return SYNC_TABLE_KEYS.some(
    (table) => diff[table].upserts.length > 0 || diff[table].deletes.length > 0,
  );
}

/** The keys of `keys` that are in at least one of `allowed`. */
function onlyKeys(keys: CarriedKeys, ...allowed: CarriedKeys[]): CarriedKeys {
  const result: CarriedKeys = {};
  for (const table of SYNC_TABLE_KEYS) {
    const kept = (keys[table] ?? []).filter((key) =>
      allowed.some((list) => (list[table] ?? []).includes(key)),
    );
    if (kept.length > 0) result[table] = kept;
  }
  return result;
}

function isEmptyKeys(keys: CarriedKeys): boolean {
  return Object.keys(keys).length === 0;
}

export function createSyncRunner(ports: SyncPorts): {
  run(trigger: SyncTrigger): Promise<SyncRunResult>;
} {
  /** One run: at most `MAX_CYCLES` cycles. The flags cover the whole run. */
  async function runOnce(trigger: SyncTrigger): Promise<SyncRunResult> {
    let applied = false;
    let changedLocal = false;
    let wroteCarried = false;

    async function cycle(): Promise<CycleEnd> {
      const baseRead = await ports.readBase();
      if (!baseRead.ok) return { error: baseRead.error };
      const snapRead = await ports.readSnapshot();
      if (!snapRead.ok) return { error: snapRead.error };
      let base = baseRead.value;
      const snap = snapRead.value;
      const { known } = snap.lookup;
      let local = withCarriedRows(snap.data, base?.data ?? null, known, base?.carried ?? {});
      // Carried keys this device wrote its own row for: those rows have no common base.
      const guarded = base !== null ? guardedKeysOf(base.carried, snap.data) : {};

      // Known carried rows (an item a curriculum update made known) go to user.db first, so the
      // learner sees the synced progress. A local write only; then read again.
      if (
        !wroteCarried &&
        base !== null &&
        !base.pendingReplace &&
        !ports.isStudyActive() &&
        changesDevice(snap.data, local, known)
      ) {
        const written = await ports.applyMerge({
          expectedLocal: snap.data,
          merged: local,
          lookup: snap.lookup,
          base: {
            revision: base.revision,
            data: base.data,
            // Guarded keys stay carried: the device row there is its own, not the base row. A known
            // key stays carried only if it was before: any other row local lacks was deleted here.
            carried: onlyKeys(
              carriedKeysOf(base.data, withoutKeys(local, guarded), known),
              base.carried,
              carriedKeysOf(base.data, base.data, known),
            ),
          },
        });
        if (!written.ok) {
          return written.error.code === 'sync_local_changed' ? 'retry' : { error: written.error };
        }
        wroteCarried = true;
        if (written.value.changedRows > 0) changedLocal = true;
        return 'restart';
      }

      if (
        (trigger === 'session_end' || trigger === 'background') &&
        base !== null &&
        !base.pendingReplace &&
        sameSyncData(local, base.data)
      ) {
        return { done: 'up_to_date' };
      }

      /** Step 8. `deviceData` is what user.db holds once the base is written. */
      async function push(
        fileData: BackupData,
        baseRevision: number,
        deviceData: BackupData,
      ): Promise<CycleEnd> {
        // One bad local row would make every other device fail to read the file.
        const checked = validateSyncData(toSyncData(fileData));
        if (!checked.ok) return { error: checked.error };
        let bytes: Uint8Array;
        try {
          bytes = await ports.encode(
            {
              schemaVersion: snap.schemaVersion,
              curriculumVersion: snap.lookup.curriculumVersion,
              exportedAt: ports.nowIso(),
            },
            fileData,
          );
        } catch (cause) {
          return { error: syncError('sync_local_failed', cause) };
        }
        const pushed = await ports.api.push(baseRevision, bytes);
        if (!pushed.ok) {
          return pushed.error.code === 'revision_conflict' ? 'retry' : { error: pushed.error };
        }
        const written = await ports.writeBase(
          {
            revision: pushed.value.revision,
            data: fileData,
            carried: carriedKeysOf(fileData, deviceData, known),
          },
          ports.nowIso(),
        );
        if (!written.ok) return { error: written.error };
        return { done: applied ? 'merged' : 'pushed' };
      }

      /** Steps 6b–6f: merge `remoteData` (at `revision`) into this device, then push if needed. */
      async function mergeRemote(remoteData: BackupData, revision: number): Promise<CycleEnd> {
        if (base !== null && revision < base.revision) {
          // A stale base (for example the account was made again): drop it and its carried rows.
          const cleared = await ports.clearBase();
          if (!cleared.ok) return { error: cleared.error };
          base = null;
          local = snap.data;
        }
        const mergeBase =
          base !== null
            ? withoutKeys(base.data, guarded)
            : isEmptyProgress(snap.data)
              ? local
              : null;
        const input = { base: mergeBase, local, remote: remoteData };

        let out = mergeSyncData(input, null);
        if (out.conflicts.length > 0) {
          ports.onPhase('conflict');
          const choice = await ports.askConflict(out.conflicts);
          ports.onPhase('syncing');
          if (choice === null) return { done: 'skipped' };
          out = mergeSyncData(input, choice);
        }
        // With a choice there is always a merged file.
        const merged = out.merged as BackupData;

        if (ports.isStudyActive() && changesDevice(snap.data, merged, known)) {
          return { done: 'deferred' };
        }

        // After the apply, user.db holds every known row of `merged`. A remote row `merged` lacks
        // was deleted by the merge and must not be carried back; only rows for unknown content are.
        const remoteBase = {
          revision,
          data: remoteData,
          carried: carriedKeysOf(remoteData, remoteData, known),
        };
        const apply = await ports.applyMerge({
          expectedLocal: snap.data,
          merged,
          lookup: snap.lookup,
          base: remoteBase,
        });
        if (!apply.ok) {
          return apply.error.code === 'sync_local_changed' ? 'retry' : { error: apply.error };
        }
        applied = true;
        if (apply.value.changedRows > 0) changedLocal = true;

        if (!sameSyncData(merged, remoteData)) return push(merged, revision, merged);
        const written = await ports.writeBase(remoteBase, ports.nowIso());
        return written.ok ? { done: 'pulled' } : { error: written.error };
      }

      const pulled = await ports.api.pull(base?.revision ?? 0);
      if (!pulled.ok) return { error: pulled.error };
      const { revision, bytes } = pulled.value;

      async function decodeRemote(remoteBytes: Uint8Array): Promise<Result<BackupData>> {
        const decoded = await ports.decode(remoteBytes);
        if (!decoded.ok) return decoded;
        if (decoded.value.schemaVersion > snap.schemaVersion) {
          return { ok: false, error: syncError('sync_update_required') };
        }
        return { ok: true, value: decoded.value.data };
      }

      // Step 4: a restore while signed in replaces the remote file; the remote is read only for
      // the schema check.
      if (base?.pendingReplace) {
        if (bytes !== null) {
          const remote = await decodeRemote(bytes);
          if (!remote.ok) return { error: remote.error };
        }
        return push(local, revision, snap.data);
      }

      // Step 5: the account is empty, or the remote is the base.
      if (revision === 0) return push(local, 0, snap.data);
      if (bytes === null) {
        // The server answers 204 only when `have === revision`, and revision is not 0: a base exists.
        const same = base as SyncBase;
        if (!sameSyncData(local, same.data)) {
          // A device row for a carried item must go through the merge (and the dialog).
          if (!isEmptyKeys(guarded)) return mergeRemote(same.data, same.revision);
          return push(local, same.revision, snap.data);
        }
        const written = await ports.writeBase(
          {
            revision: same.revision,
            data: same.data,
            carried: carriedKeysOf(same.data, snap.data, known),
          },
          ports.nowIso(),
        );
        return written.ok ? { done: 'up_to_date' } : { error: written.error };
      }

      // Step 6: merge the remote file.
      const remote = await decodeRemote(bytes);
      if (!remote.ok) return { error: remote.error };
      return mergeRemote(remote.value, revision);
    }

    let end: CycleEnd = 'retry';
    let cycles = 0;
    for (;;) {
      if (end === 'retry') {
        if (cycles === MAX_CYCLES) break;
        cycles += 1;
      } else if (end !== 'restart') {
        break;
      }
      end = await cycle();
    }
    const error = end === 'retry' ? syncError('sync_busy') : 'error' in end ? end.error : null;
    if (error === null) {
      return { status: (end as { done: SyncRunResult['status'] }).done, error, changedLocal };
    }
    if (error.code !== 'session_ended') await ports.writeError(error.code);
    return { status: 'error', error, changedLocal };
  }

  async function start(trigger: SyncTrigger): Promise<SyncRunResult> {
    if (!(await ports.isSignedIn())) return { status: 'skipped', error: null, changedLocal: false };
    ports.onPhase('syncing');
    try {
      return await runOnce(trigger);
    } finally {
      ports.onPhase('idle');
    }
  }

  let current: Promise<SyncRunResult> | null = null;
  let extra: Promise<SyncRunResult> | null = null;
  let extraTrigger: SyncTrigger = 'session_end';

  function begin(trigger: SyncTrigger): Promise<SyncRunResult> {
    const promise = start(trigger).finally(() => {
      if (current === promise) current = null;
    });
    current = promise;
    return promise;
  }

  return {
    run(trigger) {
      if (extra !== null) {
        // A manual sync always pulls: it upgrades a queued session_end run.
        if (trigger === 'manual') extraTrigger = 'manual';
        return extra;
      }
      if (current === null) return begin(trigger);
      if (trigger !== 'session_end' && trigger !== 'manual') return current;
      // One more full run after the current one, so changes made during it are synced.
      extraTrigger = trigger;
      const next = (): Promise<SyncRunResult> => {
        extra = null;
        return begin(extraTrigger);
      };
      extra = current.then(next, next);
      return extra;
    },
  };
}
