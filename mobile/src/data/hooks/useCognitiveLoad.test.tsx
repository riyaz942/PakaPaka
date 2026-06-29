import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { addDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

jest.mock('@/data/user/preferencesRepository', () => ({
  getSessionIntensity: jest.fn(() => null),
}));

describe('useCognitiveLoad', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createWrapper(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
    const contextValue: DatabaseContextValue = {
      curriculumDb: userDb,
      userDb,
      isReady: true,
      error: null,
    };

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
      );
    };
  }

  it('transitions from loading to loaded with percent from seeded data', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration008CognitiveLoadHistory]);
    addDailyLoad(userDb, { date: todayKey(), increment: 15, threshold: 30 });

    const wrapper = await createWrapper(userDb);
    const { result } = renderHook(() => useCognitiveLoad(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.todayLoad).toBe(15);
    expect(result.current.percent).toBe(50);
    expect(result.current.error).toBeNull();
  });

  it('defaults intensity to relaxed when unset', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration008CognitiveLoadHistory]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useCognitiveLoad(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.threshold).toBe(30);
  });

  it('surfaces error state on read failure', async () => {
    const userDb = await openDatabaseAsync('user.db');
    userDb.getFirstSync = () => {
      throw new Error('db read failed');
    };

    const wrapper = await createWrapper(userDb);
    const { result } = renderHook(() => useCognitiveLoad(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.code).toBe('cognitive_load_load_failed');
  });
});
