import { act, renderHook, waitFor } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../__mocks__/expo-sqlite';

import { MAX_PREFETCH } from '@/config/constants';
import type { ReviewItem } from '@/core/srs/srs.types';
import { ReviewSessionProvider, useReviewSession } from '@/providers/ReviewSessionProvider';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

const mockUseReviewQueue = jest.fn();

jest.mock('@/data/hooks/useReviewQueue', () => ({
  useReviewQueue: () => mockUseReviewQueue(),
}));

const mockUpsertSrsState = jest.fn();

jest.mock('@/data/user/srsStateRepository', () => ({
  upsertSrsState: (...args: unknown[]) => mockUpsertSrsState(...args),
}));

const NOW = '2026-06-27T10:00:00.000Z';

function makeReviewItem(id: string): ReviewItem {
  return {
    itemId: id,
    itemType: 'kanji',
    primaryForm: `kanji-${id}`,
    meanings: [`meaning-${id}`],
    promptType: 'reading',
    srsState: {
      itemId: id,
      stability: 5,
      difficulty: 5,
      dueDate: NOW,
      fsrsState: 'review',
      reps: 3,
      lapses: 0,
      isBurned: false,
      srsStageLabel: 'guru',
      updatedAt: NOW,
    },
  };
}

function makeQueue(count: number): ReviewItem[] {
  return Array.from({ length: count }, (_, index) => makeReviewItem(String(index + 1)));
}

describe('ReviewSessionProvider', () => {
  beforeEach(async () => {
    __mockResetSqlite();
    mockUpsertSrsState.mockReset();
    mockUpsertSrsState.mockReturnValue({ ok: true, value: undefined });
    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(10),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });
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
        <DatabaseContext.Provider value={contextValue}>
          <ReviewSessionProvider>{children}</ReviewSessionProvider>
        </DatabaseContext.Provider>
      );
    };
  }

  it('exposes prefetch buffer up to MAX_PREFETCH ahead of current item', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    expect(result.current.prefetchBuffer).toHaveLength(MAX_PREFETCH);
    expect(result.current.prefetchBuffer[0]?.itemId).toBe('2');
    expect(result.current.prefetchBuffer[MAX_PREFETCH - 1]?.itemId).toBe(String(MAX_PREFETCH + 1));
  });

  it('advances to next item without waiting for persist', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);
    let resolveUpsert: (() => void) | undefined;

    mockUpsertSrsState.mockImplementation(
      () =>
        new Promise<{ ok: true; value: undefined }>((resolve) => {
          resolveUpsert = () => resolve({ ok: true, value: undefined });
        }),
    );

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    expect(result.current.currentItem?.itemId).toBe('2');
    expect(mockUpsertSrsState).toHaveBeenCalledTimes(0);

    await act(async () => {
      resolveUpsert?.();
      await Promise.resolve();
    });

    expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
  });

  it('surfaces queue build errors from useReviewQueue', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: [],
      isLoading: false,
      error: {
        code: 'queue_build_failed',
        message: 'Failed to build review queue',
        userMessage: 'Could not load your review session.',
      },
      refetch: jest.fn(),
      queueBuildMs: null,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.error?.code).toBe('queue_build_failed');
    });
  });
});
