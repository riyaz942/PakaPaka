import { renderHook, waitFor } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync, __mockResetSqlite, __mockSetItems, __mockSetSrsStates } from '../../../__mocks__/expo-sqlite';
import React from 'react';

import { useLevelProgress } from '@/data/hooks/useLevelProgress';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

describe('useLevelProgress', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createWrapper(
    curriculumDb: SQLiteDatabase,
    userDb: SQLiteDatabase,
  ) {
    const contextValue: DatabaseContextValue = {
      curriculumDb,
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

  it('returns correct per-type and overall percent', async () => {
    const curriculumDb = await openDatabaseAsync('curriculum.db') as unknown as SQLiteDatabase;
    const userDb = await openDatabaseAsync('user.db') as unknown as SQLiteDatabase;

    __mockSetItems('curriculum.db', [
      { id: 1, slug: 'k1', primary_form: '一', meaning: 'one', item_type: 'kanji', jlpt_level: 'N5', sort_order: 1 },
      { id: 2, slug: 'k2', primary_form: '二', meaning: 'two', item_type: 'kanji', jlpt_level: 'N5', sort_order: 2 },
      { id: 3, slug: 'v1', primary_form: '食べる', meaning: 'eat', item_type: 'vocabulary', jlpt_level: 'N5', sort_order: 3 },
      { id: 4, slug: 'g1', primary_form: 'です', meaning: 'to be', item_type: 'grammar', jlpt_level: 'N5', sort_order: 4 },
    ]);

    __mockSetSrsStates('user.db', [
      { item_id: 1, stability: 5, difficulty: 5, due_date: '2026-06-01', fsrs_state: 'review', reps: 1, lapses: 0, is_burned: 0, srs_stage_label: 'apprentice', updated_at: '2026-06-01' },
      { item_id: 3, stability: 5, difficulty: 5, due_date: '2026-06-01', fsrs_state: 'review', reps: 1, lapses: 0, is_burned: 0, srs_stage_label: 'apprentice', updated_at: '2026-06-01' },
    ]);

    const wrapper = await createWrapper(curriculumDb, userDb);
    const { result } = renderHook(() => useLevelProgress('N5'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.perType.kanji).toEqual({ started: 1, total: 2 });
    expect(result.current.perType.vocabulary).toEqual({ started: 1, total: 1 });
    expect(result.current.perType.grammar).toEqual({ started: 0, total: 1 });
    expect(result.current.overallPercent).toBe(50);
    expect(result.current.error).toBeNull();
  });

  it('returns 0% for zero-total level without crashing', async () => {
    const curriculumDb = await openDatabaseAsync('curriculum.db') as unknown as SQLiteDatabase;
    const userDb = await openDatabaseAsync('user.db') as unknown as SQLiteDatabase;
    const wrapper = await createWrapper(curriculumDb, userDb);

    const { result } = renderHook(() => useLevelProgress('N1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.overallPercent).toBe(0);
    expect(result.current.perType.kanji.total).toBe(0);
  });

  it('surfaces error state on read failure', async () => {
    const curriculumDb = await openDatabaseAsync('curriculum.db') as unknown as SQLiteDatabase;
    const userDb = await openDatabaseAsync('user.db') as unknown as SQLiteDatabase;
    curriculumDb.getAllSync = () => {
      throw new Error('db read failed');
    };

    const wrapper = await createWrapper(curriculumDb, userDb);
    const { result } = renderHook(() => useLevelProgress('N5'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.code).toBe('level_progress_load_failed');
    expect(result.current.overallPercent).toBe(0);
  });
});
