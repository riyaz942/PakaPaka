import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AccountErrorCode, AccountSession } from '@/core/account/account.types';
import { accountErrorMessage } from '@/core/account/errorMessages';
import type { BackupData } from '@/core/backup/backup.types';
import { carriedKeysOf } from '@/core/sync/mergeSyncData';
import type { ConflictChoice, ConflictEntry, SyncErrorCode } from '@/core/sync/sync.types';
import { decodeSyncFile, encodeSyncFile } from '@/core/sync/syncCodec';
import { toSyncData } from '@/core/sync/syncFile';
import { syncError, syncErrorMessage } from '@/core/sync/syncMessages';
import { createSyncRunner, type SyncTrigger } from '@/core/sync/syncRunner';
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

export type SyncContextValue = {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  error: string | null;
  conflicts: ConflictEntry[] | null;
  /** Goes up by 1 after a run that changed rows in user.db; screens reload on it. */
  appliedVersion: number;
  syncNow(): Promise<void>;
  chooseConflict(choice: ConflictChoice): void;
  runBeforeReview(): Promise<void>;
  beginStudy(): void;
  endStudy(): void;
  replaceRemoteAfterRestore(data: BackupData): Promise<void>;
};

type State = Pick<
  SyncContextValue,
  'phase' | 'lastSyncedAt' | 'error' | 'conflicts' | 'appliedVersion'
>;

const INITIAL_STATE: State = {
  phase: 'idle',
  lastSyncedAt: null,
  error: null,
  conflicts: null,
  appliedVersion: 0,
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return value;
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

  async function runTrigger(trigger: SyncTrigger): Promise<void> {
    await gate.current;
    if (signedIn.current && clearFailed.current) {
      const cleared = await clearSyncBase(userDb);
      if (!cleared.ok) {
        merge({ error: cleared.error.userMessage ?? null });
        return;
      }
      clearFailed.current = false;
    }
    const result = await runner.run(trigger);
    // Signed out or unmounted meanwhile: the state was reset, and this run shows nothing.
    if (!signedIn.current || unmounted.current) return;
    if (result.error?.code === 'session_ended') {
      // The account provider shows the sign-out; it is not a sync error.
      void refreshAccount.current();
    }
    const status = await readSyncStatus(userDb);
    if (!signedIn.current || unmounted.current) return;
    setState((prev) => ({
      ...prev,
      lastSyncedAt: status.ok ? status.value.lastSyncedAt : prev.lastSyncedAt,
      error:
        result.error === null || result.error.code === 'session_ended'
          ? null
          : (result.error.userMessage ?? null),
      appliedVersion: result.changedLocal ? prev.appliedVersion + 1 : prev.appliedVersion,
    }));
  }

  function run(trigger: SyncTrigger): Promise<void> {
    const promise = runTrigger(trigger);
    // A queued run can end after this one; the wait covers both.
    lastRun.current = Promise.all([lastRun.current, promise]).then(() => undefined);
    return promise;
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
      void run('open');
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'background') void run('background');
      });
      return () => subscription.remove();
    }
    if (status === 'signed_out') {
      // A waiting dialog ends its run, so the clear (after the last run) can go ahead.
      conflictAnswer.current?.(null);
      studyCount.current = 0;
      setState(INITIAL_STATE);
      void hold(async () => {
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

    syncNow: () => run('manual'),

    chooseConflict(choice) {
      merge({ conflicts: null });
      conflictAnswer.current?.(choice);
    },

    runBeforeReview: () => run('before_review'),

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
