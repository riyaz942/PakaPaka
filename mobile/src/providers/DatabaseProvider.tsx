import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { Button } from '@/components/common/Button';
import { BrowseOnlyIntroModal } from '@/components/tabs/BrowseOnlyIntroModal';
import {
  MovedScreen,
  MovingScreen,
  NotRespondingScreen,
} from '@/components/tabs/TabStatusScreens';
import { checkAndApplyCurriculumUpdate } from '@/data/curriculum/curriculumUpdate';
import { initializeDatabases, type DatabaseHandles } from '@/data/database';
import {
  openSnapshotDatabases,
  serializeDatabases,
  type DbSnapshot,
} from '@/data/snapshotDatabases';
import { isWeb } from '@/platform/capabilities';
import { requestPersistentStorage } from '@/platform/requestPersistentStorage';
import { TAB_ANSWER_TIMEOUT_MS, tryAcquireDbLock, type DbLease } from '@/platform/web/dbLock';
import {
  requestSnapshot,
  serveOwnerTab,
  useHere as moveAppToThisTab,
} from '@/platform/web/tabChannel';
import {
  CurriculumUpdateContext,
  type CurriculumUpdateContextValue,
} from '@/providers/CurriculumUpdateContext';
import {
  DatabaseContext,
  type DatabaseContextValue,
} from '@/providers/DatabaseContext';
import { TabModeContext, type TabModeValue } from '@/providers/TabModeContext';
import type { AppError, Result } from '@/types/result.types';

type DatabaseProviderProps = {
  children: React.ReactNode;
};

// Web tab modes: `choose` = a second tab shows the browse-only intro modal;
// `moving` = this tab waits for the owner to let go ("Use here"); `moved` =
// this tab gave the databases to another tab.
type ProviderState =
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'choose'; browsePending: boolean }
  | { status: 'moving' }
  | { status: 'moved' }
  | {
      status: 'ready';
      curriculumDb: SQLiteDatabase;
      userDb: SQLiteDatabase;
      browseOnly: boolean;
    };

// Close failures are logged, not hidden: the caller stops the worker next,
// and a failed close there is the only trace a lost write would leave.
async function closeHandles(handles: DatabaseHandles | null): Promise<void> {
  if (!handles) {
    return;
  }
  await handles.curriculumDb
    .closeAsync()
    .catch((cause: unknown) => console.error('[DatabaseProvider] curriculum.db close failed', cause));
  await handles.userDb
    .closeAsync()
    .catch((cause: unknown) => console.error('[DatabaseProvider] user.db close failed', cause));
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [state, setState] = useState<ProviderState>({ status: 'loading' });
  const [showCurriculumUpdatedBanner, setShowCurriculumUpdatedBanner] = useState(false);
  const handlesRef = useRef<{ curriculumDb: SQLiteDatabase; userDb: SQLiteDatabase } | null>(
    null,
  );
  const updateStartedRef = useRef(false);
  // Web only: the owner tab's Web Lock, the "stop serving other tabs"
  // function, and (in a second tab) the pending snapshot answer.
  const leaseRef = useRef<DbLease | null>(null);
  const stopServingRef = useRef<(() => void) | null>(null);
  const snapshotRef = useRef<Promise<Result<DbSnapshot, AppError>> | null>(null);
  const releasePendingRef = useRef(false);

  const dismissCurriculumUpdatedBanner = useCallback(() => {
    setShowCurriculumUpdatedBanner(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (isWeb()) {
        const lease = await tryAcquireDbLock();
        if (cancelled) {
          lease?.release();
          return;
        }
        if (!lease) {
          // Another tab owns the databases. Ask it for a copy at once; the
          // intro modal shows while the copy travels.
          snapshotRef.current = requestSnapshot(TAB_ANSWER_TIMEOUT_MS);
          setState({ status: 'choose', browsePending: false });
          return;
        }
        leaseRef.current = lease;
      }

      const result = await initializeDatabases();

      if (cancelled) {
        if (result.ok) {
          await result.value.curriculumDb.closeAsync();
          await result.value.userDb.closeAsync();
        }
        return;
      }

      if (!result.ok) {
        // Do not hold the lock without databases: other tabs could then
        // never take over ("Use here" would time out).
        leaseRef.current?.release();
        leaseRef.current = null;
        setState({ status: 'error', error: result.error });
        return;
      }

      handlesRef.current = result.value;

      void requestPersistentStorage();

      if (isWeb()) {
        stopServingRef.current = serveOwnerTab({
          getSnapshot: () => {
            const handles = handlesRef.current;
            if (!handles) {
              return Promise.resolve({
                ok: false,
                error: { code: 'DB_CLOSED', message: 'The databases are closed.' },
              });
            }
            return serializeDatabases(handles);
          },
          onRelease: () => {
            // Close in an effect after the app UI has unmounted (see below).
            releasePendingRef.current = true;
            setState({ status: 'moved' });
          },
        });
      }

      if (__DEV__) {
        const metadata = result.value.curriculumDb.getFirstSync<{ version: string }>(
          'SELECT version FROM curriculum_metadata LIMIT 1',
        );
        const migrationCount = result.value.userDb.getFirstSync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM schema_migrations',
        );

        console.log('[DatabaseProvider] curriculum version:', metadata?.version);
        console.log('[DatabaseProvider] schema_migrations count:', migrationCount?.count ?? 0);
      }

      setState({
        status: 'ready',
        curriculumDb: result.value.curriculumDb,
        userDb: result.value.userDb,
        browseOnly: false,
      });
    }

    void init();

    return () => {
      cancelled = true;
      stopServingRef.current?.();
      stopServingRef.current = null;
      const handles = handlesRef.current;
      if (handles) {
        handlesRef.current = null;
        void handles.curriculumDb.closeAsync();
        void handles.userDb.closeAsync();
      }
      leaseRef.current?.release();
      leaseRef.current = null;
    };
  }, []);

  // Web owner tab, after another tab pressed "Use here". Runs after the app UI
  // has unmounted, so no screen queries a closed database. Stopping the SQLite
  // worker frees the OPFS files (patches/expo-sqlite); then the lock goes.
  useEffect(() => {
    if (state.status !== 'moved' || !releasePendingRef.current) {
      return;
    }
    releasePendingRef.current = false;
    stopServingRef.current?.();
    stopServingRef.current = null;
    const handles = handlesRef.current;
    handlesRef.current = null;

    void (async () => {
      // SQLite rolls back an open transaction on close. Say so: it would mean
      // writes that the other tab will not see.
      if (handles?.userDb.isInTransactionSync()) {
        console.error(
          '[DatabaseProvider] user.db has an open transaction at hand-off; closing rolls it back',
        );
      }
      await closeHandles(handles);
      window.dispatchEvent(new Event('expo-sqlite:stop-worker'));
      leaseRef.current?.release();
      leaseRef.current = null;
    })();
  }, [state.status]);

  /** Web second tab: Browse → open the owner's copy in memory. */
  const browse = useCallback(async () => {
    setState({ status: 'choose', browsePending: true });
    const snapshot = await snapshotRef.current;
    if (!snapshot) {
      return;
    }
    if (!snapshot.ok) {
      setState({ status: 'error', error: snapshot.error });
      return;
    }
    const opened = await openSnapshotDatabases(snapshot.value);
    if (!opened.ok) {
      setState({ status: 'error', error: opened.error });
      return;
    }
    handlesRef.current = opened.value;
    setState({
      status: 'ready',
      curriculumDb: opened.value.curriculumDb,
      userDb: opened.value.userDb,
      browseOnly: true,
    });
  }, []);

  /** Web: "Use here" — take the databases from the owner tab, then reload as owner. */
  const startUseHere = useCallback(async () => {
    setState({ status: 'moving' });
    const result = await moveAppToThisTab(TAB_ANSWER_TIMEOUT_MS);
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      return;
    }
    const handles = handlesRef.current;
    handlesRef.current = null;
    await closeHandles(handles);
    window.location.reload();
  }, []);

  // Web: when the user leaves for another page (the landing page at `/`), the
  // browser can keep this page alive in its back/forward cache. The SQLite
  // worker stops as the page hides (see patches/expo-sqlite), so that a fresh
  // load of the app can open the OPFS files. A page that comes back from that
  // cache has no databases, so it reloads.
  useEffect(() => {
    if (!isWeb()) {
      return;
    }

    const reloadIfRestored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener('pageshow', reloadIfRestored);
    return () => window.removeEventListener('pageshow', reloadIfRestored);
  }, []);

  const browseOnly = state.status === 'ready' && state.browseOnly;

  useEffect(() => {
    // A browse-only tab never updates the curriculum: it runs on a copy.
    if (state.status !== 'ready' || browseOnly || updateStartedRef.current) {
      return;
    }

    updateStartedRef.current = true;
    let cancelled = false;

    async function runBackgroundUpdate() {
      const handles = handlesRef.current;
      if (!handles) {
        return;
      }

      const updateResult = await checkAndApplyCurriculumUpdate(handles);

      if (cancelled) {
        if (updateResult.status === 'success') {
          await updateResult.curriculumDb.closeAsync();
        }
        return;
      }

      if (updateResult.status === 'success') {
        handlesRef.current = {
          curriculumDb: updateResult.curriculumDb,
          userDb: handles.userDb,
        };

        setState((current) => {
          if (current.status !== 'ready') {
            return current;
          }
          return {
            ...current,
            curriculumDb: updateResult.curriculumDb,
          };
        });

        setShowCurriculumUpdatedBanner(true);

        if (__DEV__) {
          console.log('[DatabaseProvider] curriculum updated to', updateResult.version);
        }
        return;
      }

      if (updateResult.status === 'error' && updateResult.curriculumDb) {
        const recoveredCurriculumDb = updateResult.curriculumDb;
        handlesRef.current = {
          curriculumDb: recoveredCurriculumDb,
          userDb: handles.userDb,
        };

        setState((current) => {
          if (current.status !== 'ready') {
            return current;
          }
          return {
            ...current,
            curriculumDb: recoveredCurriculumDb,
          };
        });

        if (__DEV__) {
          console.log(
            '[DatabaseProvider] curriculum swap failed; restored DB handle:',
            updateResult.error.message,
          );
        }
      }
    }

    void runBackgroundUpdate();

    return () => {
      cancelled = true;
    };
  }, [state.status, browseOnly]);

  if (state.status === 'choose') {
    return (
      <BrowseOnlyIntroModal
        browsePending={state.browsePending}
        onBrowse={() => void browse()}
        onUseHere={() => void startUseHere()}
      />
    );
  }

  if (state.status === 'moving') {
    return <MovingScreen />;
  }

  if (state.status === 'moved') {
    return <MovedScreen onUseHere={() => void startUseHere()} />;
  }

  if (state.status === 'error' && state.error.code === 'TAB_NOT_RESPONDING') {
    return <NotRespondingScreen onReload={() => window.location.reload()} />;
  }

  if (state.status === 'error' && state.error.code === 'DB_LOCKED_BY_OTHER_TAB') {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-title font-ui-bold text-primary">
          PakaPaka is open in another tab
        </Text>
        <Text className="mt-2 max-w-md text-center text-body text-muted">
          PakaPaka can run in only one tab at a time. Go back to the other tab, or close it and
          reload this page.
        </Text>
        <Button label="Reload" onPress={() => window.location.reload()} className="mt-6" />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base text-primary">
          Unable to open local databases.
        </Text>
        {isWeb() ? (
          <Text className="mt-2 text-center text-sm text-muted">
            If PakaPaka is open in another tab, close that tab and reload this page.
          </Text>
        ) : (
          <Text className="mt-2 text-center text-sm text-muted">
            {state.error.message}
          </Text>
        )}
      </View>
    );
  }

  if (state.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  const contextValue: DatabaseContextValue = {
    curriculumDb: state.curriculumDb,
    userDb: state.userDb,
    isReady: true,
    error: null,
  };

  const tabModeValue: TabModeValue = {
    browseOnly: state.browseOnly,
    useHere: () => void startUseHere(),
  };

  const curriculumUpdateContextValue: CurriculumUpdateContextValue = {
    showCurriculumUpdatedBanner,
    dismissCurriculumUpdatedBanner,
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      <TabModeContext.Provider value={tabModeValue}>
        <CurriculumUpdateContext.Provider value={curriculumUpdateContextValue}>
          {children}
        </CurriculumUpdateContext.Provider>
      </TabModeContext.Provider>
    </DatabaseContext.Provider>
  );
}
