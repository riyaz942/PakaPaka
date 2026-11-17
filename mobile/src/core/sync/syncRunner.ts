import type { BackupData } from '@/core/backup/backup.types';
import { sameSyncData } from '@/core/sync/diffSyncData';
import {
  carriedKeysOf,
  isEmptyProgress,
  mergeSyncData,
  withCarriedRows,
} from '@/core/sync/mergeSyncData';
import type { CarriedKeys, ConflictChoice, ConflictEntry } from '@/core/sync/sync.types';
import type { decodeSyncFile, encodeSyncFile } from '@/core/sync/syncCodec';
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
  askConflict(entries: ConflictEntry[]): Promise<ConflictChoice>;
  isStudyActive(): boolean;
  onPhase(phase: 'idle' | 'syncing' | 'conflict'): void;
  nowIso(): string;
};

const MAX_CYCLES = 3;

/** How a cycle ended: a result for the caller, or `retry` to read and pull again. */
type CycleEnd = { done: SyncRunResult['status'] } | { error: AppError } | 'retry';

export function createSyncRunner(ports: SyncPorts): {
  run(trigger: SyncTrigger): Promise<SyncRunResult>;
} {
  /** One run: at most `MAX_CYCLES` cycles. `applied` / `changedLocal` cover the whole run. */
  async function runOnce(trigger: SyncTrigger): Promise<SyncRunResult> {
    let applied = false;
    let changedLocal = false;

    async function cycle(): Promise<CycleEnd> {
      const baseRead = await ports.readBase();
      if (!baseRead.ok) return { error: baseRead.error };
      const snapRead = await ports.readSnapshot();
      if (!snapRead.ok) return { error: snapRead.error };
      let base = baseRead.value;
      const snap = snapRead.value;
      const { known } = snap.lookup;
      let local = withCarriedRows(snap.data, base?.data ?? null, known, base?.carried ?? {});

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
        const bytes = await ports.encode(
          {
            schemaVersion: snap.schemaVersion,
            curriculumVersion: snap.lookup.curriculumVersion,
            exportedAt: ports.nowIso(),
          },
          fileData,
        );
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
        if (!sameSyncData(local, same.data)) return push(local, same.revision, snap.data);
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

      if (base !== null && revision < base.revision) {
        // A stale base (for example the account was made again): drop it and its carried rows.
        const cleared = await ports.clearBase();
        if (!cleared.ok) return { error: cleared.error };
        base = null;
        local = snap.data;
      }
      const mergeBase = base !== null ? base.data : isEmptyProgress(snap.data) ? local : null;
      const input = { base: mergeBase, local, remote: remote.value };

      let out = mergeSyncData(input, null);
      if (out.conflicts.length > 0) {
        ports.onPhase('conflict');
        const choice = await ports.askConflict(out.conflicts);
        ports.onPhase('syncing');
        out = mergeSyncData(input, choice);
      }
      // With a choice there is always a merged file.
      const merged = out.merged as BackupData;

      if (ports.isStudyActive() && !sameSyncData(merged, local)) return { done: 'deferred' };

      // After the apply, user.db holds every known row of `merged`. A remote row `merged` lacks was
      // deleted by the merge and must not be carried back; only rows for unknown content are carried.
      const remoteBase = {
        revision,
        data: remote.value,
        carried: carriedKeysOf(remote.value, remote.value, known),
      };
      const apply = await ports.applyMerge({
        expectedLocal: snap.data,
        merged,
        lookup: snap.lookup,
        base: remoteBase,
      });
      if (!apply.ok) return apply.error.code === 'sync_local_changed' ? 'retry' : { error: apply.error };
      applied = true;
      if (apply.value.changedRows > 0) changedLocal = true;

      if (!sameSyncData(merged, remote.value)) return push(merged, revision, merged);
      const written = await ports.writeBase(remoteBase, ports.nowIso());
      return written.ok ? { done: 'pulled' } : { error: written.error };
    }

    let end: CycleEnd = 'retry';
    for (let n = 0; n < MAX_CYCLES && end === 'retry'; n += 1) {
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

  function begin(trigger: SyncTrigger): Promise<SyncRunResult> {
    const promise = start(trigger).finally(() => {
      if (current === promise) current = null;
    });
    current = promise;
    return promise;
  }

  return {
    run(trigger) {
      if (extra !== null) return extra;
      if (current === null) return begin(trigger);
      if (trigger !== 'session_end' && trigger !== 'manual') return current;
      // One more full run after the current one, so changes made during it are synced.
      const next = (): Promise<SyncRunResult> => {
        extra = null;
        return begin(trigger);
      };
      extra = current.then(next, next);
      return extra;
    },
  };
}
