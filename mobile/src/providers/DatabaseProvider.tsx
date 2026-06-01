import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { checkAndApplyCurriculumUpdate } from '@/data/curriculum/curriculumUpdate';
import { initializeDatabases } from '@/data/database';
import {
  CurriculumUpdateContext,
  type CurriculumUpdateContextValue,
} from '@/providers/CurriculumUpdateContext';
import {
  DatabaseContext,
  type DatabaseContextValue,
} from '@/providers/DatabaseContext';
import type { AppError } from '@/types/result.types';

type DatabaseProviderProps = {
  children: React.ReactNode;
};

type ProviderState =
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'ready'; curriculumDb: SQLiteDatabase; userDb: SQLiteDatabase };

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [state, setState] = useState<ProviderState>({ status: 'loading' });
  const [showCurriculumUpdatedBanner, setShowCurriculumUpdatedBanner] = useState(false);
  const handlesRef = useRef<{ curriculumDb: SQLiteDatabase; userDb: SQLiteDatabase } | null>(
    null,
  );
  const updateStartedRef = useRef(false);

  const dismissCurriculumUpdatedBanner = useCallback(() => {
    setShowCurriculumUpdatedBanner(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const result = await initializeDatabases();

      if (cancelled) {
        if (result.ok) {
          await result.value.curriculumDb.closeAsync();
          await result.value.userDb.closeAsync();
        }
        return;
      }

      if (!result.ok) {
        setState({ status: 'error', error: result.error });
        return;
      }

      handlesRef.current = result.value;

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
      });
    }

    void init();

    return () => {
      cancelled = true;
      const handles = handlesRef.current;
      if (handles) {
        handlesRef.current = null;
        void handles.curriculumDb.closeAsync();
        void handles.userDb.closeAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'ready' || updateStartedRef.current) {
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
            status: 'ready',
            curriculumDb: updateResult.curriculumDb,
            userDb: current.userDb,
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
            status: 'ready',
            curriculumDb: recoveredCurriculumDb,
            userDb: current.userDb,
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
  }, [state.status]);

  if (state.status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base text-foreground">
          Unable to open local databases.
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          {state.error.message}
        </Text>
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

  const curriculumUpdateContextValue: CurriculumUpdateContextValue = {
    showCurriculumUpdatedBanner,
    dismissCurriculumUpdatedBanner,
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      <CurriculumUpdateContext.Provider value={curriculumUpdateContextValue}>
        {children}
      </CurriculumUpdateContext.Provider>
    </DatabaseContext.Provider>
  );
}
