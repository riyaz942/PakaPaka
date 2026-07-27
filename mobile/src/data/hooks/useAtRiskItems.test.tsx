import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

import { useAtRiskItems } from './useAtRiskItems';

import type { SRSState, WeaknessStats } from '@/core/srs/srs.types';

jest.mock('@/data/user/weaknessRepository', () => ({
  getAllWeaknessStats: jest.fn(),
}));
jest.mock('@/data/user/srsStateRepository', () => ({
  getSrsStatesForItems: jest.fn(),
}));
jest.mock('@/data/curriculum/itemRepository', () => ({
  getItemById: jest.fn(),
}));

const { getAllWeaknessStats } = jest.requireMock('@/data/user/weaknessRepository');
const { getSrsStatesForItems } = jest.requireMock('@/data/user/srsStateRepository');
const { getItemById } = jest.requireMock('@/data/curriculum/itemRepository');

const PAST_ISO = '2026-06-26T10:00:00.000Z';

function weaknessStats(itemId: string): WeaknessStats {
  // 1 correct / 3 incorrect clears WEAKNESS_MIN_SAMPLE with a non-zero score.
  return {
    itemId,
    correctCount: 1,
    incorrectCount: 3,
    typoCount: 0,
    lastErrorAt: PAST_ISO,
    lastErrorType: 'meaning',
    patternTags: [],
  };
}

function srsState(itemId: string, isBurned = false): SRSState {
  return {
    itemId,
    stability: 5,
    difficulty: 5,
    dueDate: PAST_ISO,
    fsrsState: 'review',
    reps: 4,
    lapses: 3,
    learningSteps: 0,
    isBurned,
    srsStageLabel: 'apprentice',
    lastReviewedAt: PAST_ISO,
    updatedAt: PAST_ISO,
  };
}

function createWrapper(db: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue: DatabaseContextValue = {
    curriculumDb: db,
    userDb: db,
    isReady: true,
    error: null,
  };

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
  };
}

describe('useAtRiskItems', () => {
  beforeEach(() => {
    __mockResetSqlite();
    jest.clearAllMocks();
    getItemById.mockImplementation((_db: unknown, id: string) => ({
      id,
      primaryForm: `form-${id}`,
      meaning: `meaning-${id}`,
    }));
  });

  it('excludes items whose SRS row is missing', async () => {
    const db = await openDatabaseAsync('user.db');
    getAllWeaknessStats.mockReturnValue([weaknessStats('1'), weaknessStats('2')]);
    // Item 2 has a weakness row but no SRS row — the session can never serve it.
    getSrsStatesForItems.mockReturnValue(new Map([['1', srsState('1')]]));

    const { result } = renderHook(() => useAtRiskItems(), { wrapper: createWrapper(db) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.rankedItemIds).toEqual(['1']);
  });

  it('excludes burned items and keeps the rest', async () => {
    const db = await openDatabaseAsync('user.db');
    getAllWeaknessStats.mockReturnValue([weaknessStats('1'), weaknessStats('2')]);
    getSrsStatesForItems.mockReturnValue(
      new Map([
        ['1', srsState('1', true)],
        ['2', srsState('2')],
      ]),
    );

    const { result } = renderHook(() => useAtRiskItems(), { wrapper: createWrapper(db) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.topItems).toEqual([
      { itemId: '2', primaryForm: 'form-2', meaning: 'meaning-2' },
    ]);
  });
});
