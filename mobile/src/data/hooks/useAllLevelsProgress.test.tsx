import { renderHook, waitFor } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  openDatabaseAsync,
  __mockResetSqlite,
  __mockSetItems,
  __mockSetReadingPassages,
  __mockSetSrsStates,
  __mockSetPassagePracticeResults,
} from '../../../__mocks__/expo-sqlite';
import React from 'react';

import { useAllLevelsProgress } from '@/data/hooks/useAllLevelsProgress';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

describe('useAllLevelsProgress', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createWrapper(curriculumDb: SQLiteDatabase, userDb: SQLiteDatabase) {
    const contextValue: DatabaseContextValue = {
      curriculumDb,
      userDb,
      isReady: true,
      error: null,
    };

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
    };
  }

  it('summarizes progress for all five levels, marking N3-N1 as limited content', async () => {
    const curriculumDb = (await openDatabaseAsync('curriculum.db')) as unknown as SQLiteDatabase;
    const userDb = (await openDatabaseAsync('user.db')) as unknown as SQLiteDatabase;

    __mockSetItems('curriculum.db', [
      { id: 1, slug: 'r1', primary_form: '人', meaning: 'person', item_type: 'radical', jlpt_level: 'N5', sort_order: 1 },
      { id: 2, slug: 'k1', primary_form: '一', meaning: 'one', item_type: 'kanji', jlpt_level: 'N5', sort_order: 2 },
      { id: 3, slug: 'v1', primary_form: '食べる', meaning: 'eat', item_type: 'vocabulary', jlpt_level: 'N5', sort_order: 3 },
      { id: 4, slug: 'g1', primary_form: 'です', meaning: 'to be', item_type: 'grammar', jlpt_level: 'N5', sort_order: 4 },
      { id: 5, slug: 'k2', primary_form: '三', meaning: 'three', item_type: 'kanji', jlpt_level: 'N3', sort_order: 1 },
    ]);

    __mockSetSrsStates('user.db', [
      { item_id: 2, stability: 5, difficulty: 5, due_date: '2026-06-01', fsrs_state: 'review', reps: 1, lapses: 0, is_burned: 0, srs_stage_label: 'apprentice', updated_at: '2026-06-01' },
    ]);

    __mockSetReadingPassages('curriculum.db', [
      { id: 100, title: '自己紹介', jlpt_level: 'N5', sort_order: 1 },
      { id: 101, title: '休みの日', jlpt_level: 'N5', sort_order: 2 },
    ]);

    __mockSetPassagePracticeResults('user.db', [
      { passage_id: 100, question_id: 1, is_correct: 1, user_answer: 'x', answered_at: '2026-06-01' },
    ]);

    setStartingJlptLevel(userDb, 'N4');

    const wrapper = await createWrapper(curriculumDb, userDb);
    const { result } = renderHook(() => useAllLevelsProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activeLevel).toBe('N4');
    expect(result.current.levels.map((summary) => summary.level)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);

    const n5 = result.current.levels[0];
    expect(n5.hasFullContent).toBe(true);
    expect(n5.perCategory.radical).toEqual({ started: 0, total: 1 });
    expect(n5.perCategory.kanji).toEqual({ started: 1, total: 1 });
    expect(n5.perCategory.vocabulary).toEqual({ started: 0, total: 1 });
    expect(n5.perCategory.grammar).toEqual({ started: 0, total: 1 });
    expect(n5.perCategory.passage).toEqual({ started: 1, total: 2 });
    expect(n5.overallPercent).toBe(Math.round((100 * 2) / 6));

    const n3 = result.current.levels[2];
    expect(n3.hasFullContent).toBe(false);
    expect(n3.perCategory.grammar).toEqual({ started: 0, total: 0 });
    expect(n3.perCategory.passage).toEqual({ started: 0, total: 0 });
    expect(n3.perCategory.kanji).toEqual({ started: 0, total: 1 });

    expect(result.current.error).toBeNull();
  });

  it('surfaces error state on read failure', async () => {
    const curriculumDb = (await openDatabaseAsync('curriculum.db')) as unknown as SQLiteDatabase;
    const userDb = (await openDatabaseAsync('user.db')) as unknown as SQLiteDatabase;
    curriculumDb.getAllSync = () => {
      throw new Error('db read failed');
    };

    const wrapper = await createWrapper(curriculumDb, userDb);
    const { result } = renderHook(() => useAllLevelsProgress(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.code).toBe('all_levels_progress_load_failed');
    expect(result.current.levels).toEqual([]);
  });
});
