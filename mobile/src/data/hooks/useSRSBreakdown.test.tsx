import { act, renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite, __mockSetSrsStates } from '../../../__mocks__/expo-sqlite';

import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import { useSRSBreakdown } from './useSRSBreakdown';

const PAST_ISO = '2026-06-26T10:00:00.000Z';

function createWrapper(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
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

describe('useSRSBreakdown', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('transitions from loading to loaded with stage counts', async () => {
    const userDb = await openDatabaseAsync('user.db');
    __mockSetSrsStates('user.db', [
      {
        item_id: 1,
        stability: 5,
        difficulty: 5,
        due_date: PAST_ISO,
        fsrs_state: 'review',
        reps: 1,
        lapses: 0,
        is_burned: 0,
        srs_stage_label: 'apprentice',
        updated_at: PAST_ISO,
      },
      {
        item_id: 2,
        stability: 5,
        difficulty: 5,
        due_date: PAST_ISO,
        fsrs_state: 'review',
        reps: 2,
        lapses: 0,
        is_burned: 0,
        srs_stage_label: 'guru',
        updated_at: PAST_ISO,
      },
    ]);

    const { result } = renderHook(() => useSRSBreakdown(), {
      wrapper: createWrapper(userDb),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.counts).toEqual({
      apprentice: 1,
      guru: 1,
      master: 0,
      enlightened: 0,
      burned: 0,
    });
    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('refetch reloads counts after data changes', async () => {
    const userDb = await openDatabaseAsync('user.db');

    const { result } = renderHook(() => useSRSBreakdown(), {
      wrapper: createWrapper(userDb),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.total).toBe(0);

    __mockSetSrsStates('user.db', [
      {
        item_id: 1,
        stability: 5,
        difficulty: 5,
        due_date: PAST_ISO,
        fsrs_state: 'review',
        reps: 1,
        lapses: 0,
        is_burned: 0,
        srs_stage_label: 'master',
        updated_at: PAST_ISO,
      },
    ]);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.counts.master).toBe(1);
    });
    expect(result.current.total).toBe(1);
  });

  it('sets error and clears loading when getSrsStageCounts throws', async () => {
    const userDb = await openDatabaseAsync('user.db');
    const throwingDb = {
      ...userDb,
      getAllSync: () => {
        throw new Error('db read failed');
      },
    };

    const { result } = renderHook(() => useSRSBreakdown(), {
      wrapper: createWrapper(throwingDb as unknown as Awaited<ReturnType<typeof openDatabaseAsync>>),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toMatchObject({
      code: 'srs_breakdown_load_failed',
    });
  });
});
