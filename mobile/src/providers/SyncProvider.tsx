import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AccountErrorCode, AccountSession } from '@/core/account/account.types';
import { accountErrorMessage } from '@/core/account/errorMessages';
import type { BackupData } from '@/core/backup/backup.types';
import { hasUnsyncedChanges } from '@/core/sync/hasUnsyncedChanges';
import { carriedKeysOf } from '@/core/sync/mergeSyncData';
import type { ConflictChoice, ConflictEntry, SyncErrorCode } from '@/core/sync/sync.types';
import { decodeSyncFile, encodeSyncFile } from '@/core/sync/syncCodec';
import { toSyncData } from '@/core/sync/syncFile';
import { syncError, syncErrorMessage } from '@/core/sync/syncMessages';
import { createSyncRunner, type SyncRunResult, type SyncTrigger } from '@/core/sync/syncRunner';
import { createAccountSession } from '@/data/account/session';
import { useDatabase } from '@/data/hooks/useDatabase';
import { createSyncApi } from '@/data/sync/syncApi';
import { applySyncMerge } from '@/data/sync/syncApply';
import {
  clearSyncBase,
  markPendingReplace,
  readSyncBase,
  readSyncStatus,
  writeSyncBase,
  writeSyncError,
} from '@/data/sync/syncBaseStore';
import { readSyncSnapshot } from '@/data/sync/syncSnapshot';
import { useAccount } from '@/providers/AccountProvider';

export type SyncPhase = 'idle' | 'syncing' | 'conflict';

/** The sync that runs when the app opens signed in: `'none'` while the account is not signed in. */
export type FirstRun = 'none' | 'running' | 'ok' | 'failed';

/**
 * After a session that ended without the user: `'erase'` when nothing is unsynced, `'ask'` when
 * something is (or the check could not read it). `'none'` otherwise.
 */
export type SessionEnd = 'none' | 'erase' | 'ask';

export type SyncContextValue = {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  error: string | null;
  conflicts: ConflictEntry[] | null;
  /** Goes up by 1 after a run that changed rows in user.db; screens reload on it. */
  appliedVersion: number;
  firstRun: FirstRun;
  sessionEnd: SessionEnd;
  syncNow(): Promise<void>;
  /** Runs the first-run sync again after it failed. */
  retryFirstRun(): Promise<void>;
  /** Runs one sync; `true` only when it ended with this device and the server in line. */
  syncBeforeSignOut(): Promise<boolean>;
  chooseConflict(choice: ConflictChoice): void;
  runBeforeReview(): Promise<void>;
  beginStudy(): void;
  endStudy(): void;
  replaceRemoteAfterRestore(data: BackupData): Promise<void>;
};

type State = Pick<
  SyncContextValue,
  'phase' | 'lastSyncedAt' | 'error' | 'conflicts' | 'appliedVersion' | 'firstRun' | 'sessionEnd'
>;

const INITIAL_STATE: State = {
  phase: 'idle',
  lastSyncedAt: null,
  error: null,
  conflicts: null,
  appliedVersion: 0,
  firstRun: 'none',
  sessionEnd: 'none',
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return value;
}

/** True when the run ended with this device and the server in line. */
function isGoodRun(result: SyncRunResult | null): boolean {
  return (
    result !== null && ['up_to_date', 'pushed', 'pulled', 'merged'].includes(result.status)
  );
}

/** The text for a stored error code: a sync code or an account code. */
function messageForCode(code: string): string | null {
  if (code.startsWith('sync_')) return syncErrorMessage(code as SyncErrorCode) ?? null;
  return accountErrorMessage(code as AccountErrorCode) ?? null;
}

export function SyncProvider({
  children,
  session: injected,
}: {
  children: React.ReactNode;
  /** Tests pass a session; the app uses the platform default. */
  session?: AccountSession;
}) {
  const account = useAccount();
  const { userDb } = useDatabase();
  const [session] = useState(() => injected ?? createAccountSession());
  const [state, setState] = useState<State>(INITIAL_STATE);

  const signedIn = useRef(false);
  signedIn.current = account.status === 'signed_in';
  const refreshAccount = useRef(account.refresh);
  refreshAccount.current = account.refresh;
  const studyCount = useRef(0);
  const studyTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  /** Answers the waiting conflict dialog; `null` ends that run with nothing written. */
  const conflictAnswer = useRef<((choice: ConflictChoice | null) => void) | null>(null);
  /** Every run started so far: a sign-out clear and a restore mark wait until they ended. */
  const lastRun = useRef<Promise<void>>(Promise.resolve());
  const unmounted = useRef(false);
  /** Goes up at each sign-out: a run from an earlier sign-in shows nothing for the new one. */
  const generation = useRef(0);
  /** Every run waits for this before it starts: the base clear, or a restore mark. */
  const gate = useRef<Promise<void>>(Promise.resolve());
  /** The last base clear failed; the next run tries once more first. */
  const clearFailed = useRef(false);

  const merge = (patch: Partial<State>) => setState((prev) => ({ ...prev, ...patch }));

  const runner = useMemo(
    () =>
      createSyncRunner({
        isSignedIn: async () => signedIn.current,
        readSnapshot: () => readSyncSnapshot(userDb),
        readBase: () => readSyncBase(userDb),
        applyMerge: (args) => applySyncMerge(userDb, args),
        async writeBase(base, syncedAt) {
          try {
            await writeSyncBase(userDb, base, syncedAt);
            return { ok: true, value: undefined };
          } catch (cause) {
            return { ok: false, error: syncError('sync_local_failed', cause) };
          }
        },
        clearBase: () => clearSyncBase(userDb),
        async writeError(code) {
          await writeSyncError(userDb, code);
        },
        api: createSyncApi(session.request),
        encode: encodeSyncFile,
        decode: decodeSyncFile,
        askConflict: (entries) =>
          new Promise<ConflictChoice | null>((resolve) => {
            conflictAnswer.current = (choice) => {
              conflictAnswer.current = null;
              resolve(choice);
            };
            setState((prev) => ({ ...prev, conflicts: entries }));
          }),
        isStudyActive: () => studyCount.current > 0,
        onPhase: (phase) => setState((prev) => ({ ...prev, phase })),
        nowIso: () => new Date().toISOString(),
      }),
    [userDb, session],
  );

  /** Runs `task` after the gate and the last run; a run that starts meanwhile waits for it. */
  function hold<T>(task: () => Promise<T>): Promise<T> {
    const held = Promise.all([gate.current, lastRun.current]).then(task);
    gate.current = held.then(
      () => undefined,
      () => undefined,
    );
    return held;
  }

  async function runTrigger(trigger: SyncTrigger): Promise<SyncRunResult | null> {
    const started = generation.current;
    await gate.current;
    if (signedIn.current && clearFailed.current) {
      const cleared = await clearSyncBase(userDb);
      if (!cleared.ok) {
        merge({ error: cleared.error.userMessage ?? null });
        return null;
      }
      clearFailed.current = false;
    }
    const result = await runner.run(trigger);
    // Signed out or unmounted meanwhile: the state was reset, and this run shows nothing.
    if (!signedIn.current || unmounted.current || generation.current !== started) return null;
    if (result.error?.code === 'session_ended') {
      // The account provider shows the sign-out; it is not a sync error.
      void refreshAccount.current();
    }
    const status = await readSyncStatus(userDb);
    if (!signedIn.current || unmounted.current || generation.current !== started) return null;
    setState((prev) => ({
      ...prev,
      lastSyncedAt: status.ok ? status.value.lastSyncedAt : prev.lastSyncedAt,
      error:
        result.error === null || result.error.code === 'session_ended'
          ? null
          : (result.error.userMessage ?? null),
      appliedVersion: result.changedLocal ? prev.appliedVersion + 1 : prev.appliedVersion,
    }));
    return result;
  }

  function run(trigger: SyncTrigger): Promise<SyncRunResult | null> {
    const promise = runTrigger(trigger);
    // A queued run can end after this one; the wait covers both.
    lastRun.current = Promise.all([lastRun.current, promise]).then(() => undefined);
    return promise;
  }

  /** Shows how the first-run sync ended, unless the sign-in or the provider is gone by then. */
  function endFirstRun(result: SyncRunResult | null, started: number) {
    if (!signedIn.current || unmounted.current || generation.current !== started) return;
    merge({ firstRun: isGoodRun(result) ? 'ok' : 'failed' });
  }

  const status = account.status;
  useEffect(() => {
    if (status === 'signed_in') {
      void (async () => {
        await gate.current;
        const stored = await readSyncStatus(userDb);
        if (stored.ok && signedIn.current) {
          merge({
            lastSyncedAt: stored.value.lastSyncedAt,
            error:
              stored.value.lastErrorCode === null ? null : messageForCode(stored.value.lastErrorCode),
          });
        }
      })();
      merge({ firstRun: 'running', sessionEnd: 'none' });
      const started = generation.current;
      void run('open').then((result) => endFirstRun(result, started));
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'background') void run('background');
      });
      return () => subscription.remove();
    }
    if (status === 'signed_out') {
      // A waiting dialog ends its run, so the clear (after the last run) can go ahead.
      conflictAnswer.current?.(null);
      generation.current += 1;
      // A review or lesson that is open can still write answers, so the check asks first.
      const studying = studyCount.current > 0;
      studyCount.current = 0;
      setState(INITIAL_STATE);
      const ended = account.sessionEnded;
      const signedOutAt = generation.current;
      void hold(async () => {
        // The check reads the base, so it runs before the clear. A read error asks.
        if (ended) {
          const base = await readSyncBase(userDb);
          const snapshot = base.ok ? await readSyncSnapshot(userDb) : null;
          const unsynced =
            studying ||
            !base.ok ||
            snapshot === null ||
            !snapshot.ok ||
            hasUnsyncedChanges(snapshot.value.data, base.value, snapshot.value.lookup.known);
          if (!signedIn.current && !unmounted.current && generation.current === signedOutAt) {
            merge({ sessionEnd: unsynced ? 'ask' : 'erase' });
          }
        }
        const cleared = await clearSyncBase(userDb);
        clearFailed.current = !cleared.ok;
      });
    }
    return undefined;
    // run and hold are recreated each render; the triggers follow the account status only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userDb]);

  useEffect(() => {
    const timers = studyTimers.current;
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      conflictAnswer.current?.(null);
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const value: SyncContextValue = {
    ...state,

    async syncNow() {
      await run('manual');
    },

    async retryFirstRun() {
      if (!signedIn.current || unmounted.current) return;
      const started = generation.current;
      merge({ firstRun: 'running' });
      endFirstRun(await run('manual'), started);
    },

    async syncBeforeSignOut() {
      return isGoodRun(await run('manual'));
    },

    chooseConflict(choice) {
      merge({ conflicts: null });
      conflictAnswer.current?.(choice);
    },

    async runBeforeReview() {
      await run('before_review');
    },

    beginStudy() {
      studyCount.current += 1;
    },

    endStudy() {
      studyCount.current = Math.max(0, studyCount.current - 1);
      // After the current tick, so the session's last writes are done first.
      const timer = setTimeout(() => {
        studyTimers.current.delete(timer);
        void run('session_end');
      }, 0);
      studyTimers.current.add(timer);
    },

    async replaceRemoteAfterRestore(data) {
      if (!signedIn.current) return;
      // A run that is still going writes its base when it ends, and that write clears the mark;
      // so the mark waits for the last run, and no run starts until it is written.
      const marked = await hold(async () => {
        const snapshot = await readSyncSnapshot(userDb);
        if (!snapshot.ok) return snapshot;
        const file = toSyncData(data);
        return markPendingReplace(
          userDb,
          file,
          carriedKeysOf(file, snapshot.value.data, snapshot.value.lookup.known),
        );
      });
      if (!marked.ok) {
        merge({ error: marked.error.userMessage ?? null });
        return;
      }
      await run('manual');
    },
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
