import { renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { addDaysToKey, weekStartKey } from '@/core/cognitive-load/thresholdCalculator';
import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { migration015GoalRingState } from '@/data/migrations/015_goal_ring_state';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { useCognitiveLoad } from '@/data/hooks/useCognitiveLoad';
import { addDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { runWeeklyGoalCheck, setDailyGoalTarget } from '@/data/user/goalRingRepository';
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
    runMigrations(userDb, [migration008CognitiveLoadHistory, migration015GoalRingState]);
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
    runMigrations(userDb, [migration008CognitiveLoadHistory, migration015GoalRingState]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useCognitiveLoad(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.threshold).toBe(30);
  });

  it('uses the sticky goal as denominator and reports raw overshoot', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration008CognitiveLoadHistory, migration015GoalRingState]);
    expect(setDailyGoalTarget(userDb, 20).ok).toBe(true);
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

  it('runs the weekly check on read and surfaces a pending rise', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration008CognitiveLoadHistory, migration015GoalRingState]);

    // Anchor the ratchet in the prior week, then seed three strong active days
    // there. The hook's read runs the weekly check for the current week.
    const thisWeekStart = weekStartKey(new Date());
    const priorWeekStart = addDaysToKey(thisWeekStart, -7);
    const [py, pm, pd] = priorWeekStart.split('-').map(Number);
    runWeeklyGoalCheck(userDb, new Date(py, pm - 1, pd));
    for (let day = 0; day < 3; day++) {
      addDailyLoad(userDb, {
        date: addDaysToKey(priorWeekStart, day),
        increment: 60,
        threshold: 30,
      });
    }

    const wrapper = await createWrapper(userDb);
    const { result } = renderHook(() => useCognitiveLoad(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pendingRiseTo).toBe(60);
    // The goal itself is untouched until the user accepts.
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
