import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { initializeDatabases } from '@/data/database';
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
  const handlesRef = useRef<{ curriculumDb: SQLiteDatabase; userDb: SQLiteDatabase } | null>(
    null,
  );

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

  return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
}
