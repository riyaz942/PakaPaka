import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import {
  __mockResetSqlite,
  __mockSetPassageGrammarLinks,
  __mockSetPassageVocabularyLinks,
  __mockSetReadingPassages,
  __mockSetSrsStates,
} from '../../../__mocks__/expo-sqlite';

import { useReadingReadiness } from '@/data/hooks/useReadingReadiness';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: jest.fn(() => 'N5'),
}));

function srsRow(itemId: number, stage: string) {
  return {
    item_id: itemId,
    stability: 5,
    difficulty: 5,
    due_date: '2026-07-21T00:00:00.000Z',
    fsrs_state: 'review',
    reps: 3,
    lapses: 0,
    is_burned: stage === 'burned' ? 1 : 0,
    srs_stage_label: stage,
    updated_at: '2026-07-19T00:00:00.000Z',
  };
}

describe('useReadingReadiness', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function setup() {
    const curriculumDb = await openDatabaseAsync('curriculum.db');
    const userDb = await openDatabaseAsync('user.db');
    const contextValue: DatabaseContextValue = {
      curriculumDb: curriculumDb as never,
      userDb: userDb as never,
      isReady: true,
      error: null,
    };
    const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
      );
    };
    return { wrapper };
  }

  it('returns null when no passages exist', async () => {
    const { wrapper } = await setup();
    const { result } = renderHook(() => useReadingReadiness(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.target).toBeNull();
  });

  it('picks the closest-to-unlocking locked passage at the user level', async () => {
    __mockSetReadingPassages('curriculum.db', [
      { id: 1, jlpt_level: 'N5', title: 'Close', sort_order: 1 },
      { id: 2, jlpt_level: 'N5', title: 'Far', sort_order: 2 },
    ]);
    // Passage 1: 2 linked, 1 at guru → need ceil(1.8)=2 → 1 remaining.
    // Passage 2: 2 linked, 0 at guru → 2 remaining.
    __mockSetPassageVocabularyLinks('curriculum.db', [
      { passage_id: 1, vocabulary_item_id: 10 },
      { passage_id: 2, vocabulary_item_id: 20 },
    ]);
    __mockSetPassageGrammarLinks('curriculum.db', [
      { passage_id: 1, grammar_item_id: 11 },
      { passage_id: 2, grammar_item_id: 21 },
    ]);
    __mockSetSrsStates('user.db', [srsRow(10, 'guru'), srsRow(20, 'apprentice')]);

    const { wrapper } = await setup();
    const { result } = renderHook(() => useReadingReadiness(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.target).toMatchObject({
      passageId: '1',
      title: 'Close',
      itemsRemainingToUnlock: 1,
      noProgressYet: false,
    });
  });

  it('hides readiness (null) when all linked passages are unlocked', async () => {
    __mockSetReadingPassages('curriculum.db', [
      { id: 1, jlpt_level: 'N5', title: 'Done', sort_order: 1 },
    ]);
    __mockSetPassageVocabularyLinks('curriculum.db', [
      { passage_id: 1, vocabulary_item_id: 10 },
    ]);
    __mockSetPassageGrammarLinks('curriculum.db', []);
    __mockSetSrsStates('user.db', [srsRow(10, 'burned')]);

    const { wrapper } = await setup();
    const { result } = renderHook(() => useReadingReadiness(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.target).toBeNull();
  });

  it('skips passages without links and flags day-1 noProgressYet', async () => {
    __mockSetReadingPassages('curriculum.db', [
      { id: 1, jlpt_level: 'N5', title: 'Unlinked', sort_order: 1 },
      { id: 2, jlpt_level: 'N5', title: 'Linked', sort_order: 2 },
    ]);
    __mockSetPassageVocabularyLinks('curriculum.db', [
      { passage_id: 2, vocabulary_item_id: 20 },
    ]);
    __mockSetPassageGrammarLinks('curriculum.db', []);

    const { wrapper } = await setup();
    const { result } = renderHook(() => useReadingReadiness(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.target).toMatchObject({
      passageId: '2',
      noProgressYet: true,
    });
  });
});
