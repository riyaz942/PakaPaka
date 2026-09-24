import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { addDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

let mockGoalTarget = 15;

jest.mock('@/data/user/goalRingRepository', () => ({
  resolveDailyGoalTarget: jest.fn(() => mockGoalTarget),
}));

describe('useCognitiveLoad', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockGoalTarget = 15;
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
    expect(result.current.percent).toBe(100);
    expect(result.current.error).toBeNull();
  });

  it('uses the daily goal target as denominator and reports raw overshoot', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration008CognitiveLoadHistory]);
    mockGoalTarget = 20;
    addDailyLoad(userDb, { date: todayKey(), increment: 30, threshold: 20 });

    const wrapper = await createWrapper(userDb);
    const { result } = renderHook(() => useCognitiveLoad(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.threshold).toBe(20);
    expect(result.current.percent).toBe(150);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isOvershoot).toBe(true);
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
