import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration009Streak } from '@/data/migrations/009_streak';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { useStreak } from '@/data/hooks/useStreak';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { recordReviewAndUpdateStreak, yesterdayKey } from '@/data/user/streakRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

jest.mock('@/data/user/cognitiveLoadRepository', () => {
  const actual = jest.requireActual('@/data/user/cognitiveLoadRepository');
  return {
    ...actual,
    todayKey: jest.fn(() => '2026-06-29'),
  };
});

describe('useStreak', () => {
  beforeEach(() => {
    __mockResetSqlite();
    (todayKey as jest.Mock).mockReturnValue('2026-06-29');
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

  it('transitions from loading to loaded with default streak', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration009Streak]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useStreak(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.currentStreak).toBe(0);
    expect(result.current.streakState).toBe('broken');
    expect(result.current.error).toBeNull();
  });

  it('returns active when last review was today', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration009Streak]);
    recordReviewAndUpdateStreak(userDb, '2026-06-29');
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useStreak(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.streakState).toBe('active');
    expect(result.current.currentStreak).toBe(1);
  });

  it('returns at-risk when last review was yesterday', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration009Streak]);
    recordReviewAndUpdateStreak(userDb, yesterdayKey('2026-06-29'));
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useStreak(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.streakState).toBe('at-risk');
    expect(result.current.currentStreak).toBe(1);
  });

  it('returns broken when streak is zero', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration009Streak]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useStreak(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.streakState).toBe('broken');
  });

  it('surfaces error state on read failure', async () => {
    const userDb = await openDatabaseAsync('user.db');
    userDb.getFirstSync = () => {
      throw new Error('db read failed');
    };
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useStreak(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.code).toBe('streak_load_failed');
  });
});
