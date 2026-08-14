import { act, renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';
import { AccessibilityInfo } from 'react-native';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import {
  getReducedMotionEnabled,
  setReducedMotionEnabled,
} from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

describe('useReducedMotion', () => {
  beforeEach(() => {
    __mockResetSqlite();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
      (() => ({ remove: jest.fn() })) as unknown as typeof AccessibilityInfo.addEventListener,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('reflects the system setting when the in-app preference is unset', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReducedMotion(), { wrapper });

    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(true);
      expect(result.current.preference).toBeNull();
    });
  });

  it('uses the in-app override when set', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    setReducedMotionEnabled(userDb, true);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReducedMotion(), { wrapper });

    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(true);
      expect(result.current.preference).toBe(true);
    });
  });

  it('still honors system reduce motion when explicit override is false', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    setReducedMotionEnabled(userDb, false);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReducedMotion(), { wrapper });

    await waitFor(() => {
      expect(result.current.preference).toBe(false);
      expect(result.current.reducedMotion).toBe(true);
    });
  });

  it('updates when reduceMotionChanged fires', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      eventName: string,
      cb: (enabled: boolean) => void,
    ) => {
      if (eventName === 'reduceMotionChanged') {
        listener = cb;
      }
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener);

    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReducedMotion(), { wrapper });

    await waitFor(() => {
      expect(result.current.reducedMotion).toBe(false);
    });

    await act(async () => {
      listener?.(true);
    });

    expect(result.current.reducedMotion).toBe(true);
    expect(getReducedMotionEnabled(userDb)).toBeNull();
  });

  it('persists an explicit toggle override', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReducedMotion(), { wrapper });

    await waitFor(() => {
      expect(result.current.preference).toBeNull();
    });

    await act(async () => {
      result.current.setReducedMotion(true);
    });

    expect(getReducedMotionEnabled(userDb)).toBe(true);
    expect(result.current.reducedMotion).toBe(true);
  });

  it('refetches after an out-of-band preference write', async () => {
    const userDb = await openDatabaseAsync('user.db');
    runMigrations(userDb, [migration001Initial]);
    const wrapper = await createWrapper(userDb);

    const { result } = renderHook(() => useReducedMotion(), { wrapper });
    await waitFor(() => {
      expect(result.current.preference).toBeNull();
    });

    setReducedMotionEnabled(userDb, true);
    await act(async () => {
      result.current.refetch();
    });

    expect(result.current.preference).toBe(true);
    expect(result.current.reducedMotion).toBe(true);
  });
});
