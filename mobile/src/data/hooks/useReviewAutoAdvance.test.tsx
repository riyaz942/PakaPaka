import { act, renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { useReviewAutoAdvance } from '@/data/hooks/useReviewAutoAdvance';
import {
  getReviewAutoAdvanceEnabled,
  setReviewAutoAdvanceEnabled,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

describe('useReviewAutoAdvance (Story 1.2, FR84)', () => {
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

  it('defaults to OFF when the preference is unset', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReviewAutoAdvance(), { wrapper });

    expect(result.current.autoAdvanceEnabled).toBe(false);
  });

  it('reflects a stored ON preference', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    setReviewAutoAdvanceEnabled(userDb, true);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReviewAutoAdvance(), { wrapper });

    await waitFor(() => {
      expect(result.current.autoAdvanceEnabled).toBe(true);
    });
  });

  it('persists the toggle', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReviewAutoAdvance(), { wrapper });

    await act(async () => {
      result.current.setAutoAdvanceEnabled(true);
    });

    expect(getReviewAutoAdvanceEnabled(userDb)).toBe(true);
    expect(result.current.autoAdvanceEnabled).toBe(true);
  });

  it('refetches after an out-of-band preference write', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReviewAutoAdvance(), { wrapper });
    expect(result.current.autoAdvanceEnabled).toBe(false);

    setReviewAutoAdvanceEnabled(userDb, true);
    await act(async () => {
      result.current.refetch();
    });

    expect(result.current.autoAdvanceEnabled).toBe(true);
  });
});
