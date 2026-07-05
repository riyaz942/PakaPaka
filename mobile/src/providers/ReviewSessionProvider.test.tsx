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
const mockApplyBoosts = jest.fn();
const mockClearBoosts = jest.fn();
const mockGetDailyLoad = jest.fn();
const mockGetRecentDailyLoads = jest.fn();
const mockAddDailyLoad = jest.fn();
const mockGetSessionIntensity = jest.fn();
const mockRecordReviewAndUpdateStreak = jest.fn();

jest.mock('@/data/user/srsStateRepository', () => ({
  upsertSrsState: (...args: unknown[]) => mockUpsertSrsState(...args),
}));

jest.mock('@/data/user/relatedItemBoostRepository', () => ({
  applyBoosts: (...args: unknown[]) => mockApplyBoosts(...args),
  clearBoosts: (...args: unknown[]) => mockClearBoosts(...args),
}));

jest.mock('@/data/user/cognitiveLoadRepository', () => ({
  getDailyLoad: (...args: unknown[]) => mockGetDailyLoad(...args),
  getRecentDailyLoads: (...args: unknown[]) => mockGetRecentDailyLoads(...args),
  addDailyLoad: (...args: unknown[]) => mockAddDailyLoad(...args),
  todayKey: () => '2026-06-28',
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getSessionIntensity: (...args: unknown[]) => mockGetSessionIntensity(...args),
}));

jest.mock('@/data/user/streakRepository', () => ({
  recordReviewAndUpdateStreak: (...args: unknown[]) => mockRecordReviewAndUpdateStreak(...args),
}));

const NOW = '2026-06-27T10:00:00.000Z';

function makeReviewItem(id: string, itemType: ReviewItem['itemType'] = 'kanji'): ReviewItem {
  return {
    itemId: id,
    itemType,
    primaryForm: `kanji-${id}`,
    meanings: [`meaning-${id}`],
    promptType: 'reading',
    answerKey: {
      acceptedMeanings: [`meaning-${id}`],
      acceptedReadings: ['いち'],
    },
    relatedItems: [],
    reinforcementLink: null,
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
      lastReviewedAt: null,
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
    mockApplyBoosts.mockReset();
    mockClearBoosts.mockReset();
    mockGetDailyLoad.mockReset();
    mockGetRecentDailyLoads.mockReset();
    mockAddDailyLoad.mockReset();
    mockGetSessionIntensity.mockReset();
    mockRecordReviewAndUpdateStreak.mockReset();
    mockUpsertSrsState.mockReturnValue({ ok: true, value: undefined });
    mockApplyBoosts.mockReturnValue({ ok: true, value: undefined });
    mockClearBoosts.mockReturnValue({ ok: true, value: undefined });
    mockGetDailyLoad.mockReturnValue(null);
    mockGetRecentDailyLoads.mockReturnValue([]);
    mockGetSessionIntensity.mockReturnValue('relaxed');
    mockAddDailyLoad.mockReturnValue({ ok: true, value: undefined });
    mockRecordReviewAndUpdateStreak.mockReturnValue({
      ok: true,
      value: { currentStreak: 1, longestStreak: 1, lastReviewDate: '2026-06-28' },
    });
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

  it('applies related-item boosts on correct grade, not on Again', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const itemWithRelated: ReviewItem = {
      ...makeReviewItem('1'),
      relatedItems: [
        {
          id: '2',
          itemType: 'vocabulary',
          primaryForm: '食べる',
          meaning: 'to eat',
          relationshipType: 'reinforces',
        },
      ],
    };

    mockUseReviewQueue.mockReturnValue({
      queue: [itemWithRelated, ...makeQueue(9).slice(1)],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApplyBoosts).toHaveBeenCalledTimes(1);

    mockApplyBoosts.mockClear();

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(10),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    act(() => {
      result.current.gradeCurrentItem(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApplyBoosts).not.toHaveBeenCalled();
  });

  it('does not block advance when boost persist fails', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const itemWithRelated: ReviewItem = {
      ...makeReviewItem('1'),
      relatedItems: [
        {
          id: '2',
          itemType: 'vocabulary',
          primaryForm: '食べる',
          meaning: 'to eat',
          relationshipType: 'reinforces',
        },
      ],
    };

    mockUseReviewQueue.mockReturnValue({
      queue: [itemWithRelated, ...makeQueue(9).slice(1)],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    mockApplyBoosts.mockReturnValue({
      ok: false,
      error: { code: 'boost_apply_failed', message: 'fail' },
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    expect(result.current.currentItem?.itemId).toBe('2');
  });

  it('increases cognitive load percent after a correct grade', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    expect(result.current.cognitiveLoadPercent).toBe(0);

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.cognitiveLoadPercent).toBeGreaterThan(0);
    expect(mockAddDailyLoad).toHaveBeenCalled();
  });

  it('increases cognitive load more after an incorrect grade than correct', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result: correctResult } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(correctResult.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      correctResult.current.gradeCurrentItem(3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const correctPercent = correctResult.current.cognitiveLoadPercent;

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(10),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result: incorrectResult } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(incorrectResult.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      incorrectResult.current.gradeCurrentItem(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(incorrectResult.current.cognitiveLoadPercent).toBeGreaterThan(correctPercent);
  });

  it('does not change cognitive load on typo', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    const before = result.current.cognitiveLoadPercent;

    act(() => {
      result.current.recordTypoForCurrentItem();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.cognitiveLoadPercent).toBe(before);
    expect(mockAddDailyLoad).not.toHaveBeenCalled();
  });

  it('records streak on the first graded item, once per session', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    expect(mockRecordReviewAndUpdateStreak).not.toHaveBeenCalled();

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRecordReviewAndUpdateStreak).toHaveBeenCalledTimes(1);
    expect(mockRecordReviewAndUpdateStreak).toHaveBeenCalledWith(db, '2026-06-28');

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('2');
    });

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Still only once — subsequent grades in the same session don't re-record.
    expect(mockRecordReviewAndUpdateStreak).toHaveBeenCalledTimes(1);
  });

  it('does not record streak before any item is graded', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    expect(result.current.isComplete).toBe(false);
    expect(mockRecordReviewAndUpdateStreak).not.toHaveBeenCalled();
  });

  it('consumes the graded item boost at grade time', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    expect(mockClearBoosts).not.toHaveBeenCalled();

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockClearBoosts).toHaveBeenCalledWith(db, ['1']);
  });

  it('increments domain counters per gradeCurrentItem by item type', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const vocabularyItem: ReviewItem = { ...makeReviewItem('1', 'vocabulary') };
    const grammarItem: ReviewItem = { ...makeReviewItem('2', 'grammar') };

    mockUseReviewQueue.mockReturnValue({
      queue: [vocabularyItem, grammarItem],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('2');
    });

    act(() => {
      result.current.gradeCurrentItem(1);
    });

    expect(result.current.sessionSummary.domainCounts.vocabulary).toBe(1);
    expect(result.current.sessionSummary.domainCounts.grammar).toBe(1);
    expect(result.current.sessionSummary.itemsReviewed).toBe(2);
  });

  it('increments correctCount on Good/Easy grades but not on Again', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const items = makeQueue(3);

    mockUseReviewQueue.mockReturnValue({
      queue: items,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // Good (correct)
    act(() => {
      result.current.gradeCurrentItem(3);
    });
    expect(result.current.sessionSummary.correctCount).toBe(1);

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('2');
    });

    // Again (incorrect) — must not increment
    act(() => {
      result.current.gradeCurrentItem(1);
    });
    expect(result.current.sessionSummary.correctCount).toBe(1);

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('3');
    });

    // Easy (correct)
    act(() => {
      result.current.gradeCurrentItem(4);
    });

    expect(result.current.sessionSummary.correctCount).toBe(2);
    expect(result.current.sessionSummary.itemsReviewed).toBe(3);
  });

  it('does not increment correctCount on recordTypoForCurrentItem', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      result.current.recordTypoForCurrentItem();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.sessionSummary.correctCount).toBe(0);
  });

  it('does not increment domain counters on recordTypoForCurrentItem', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    act(() => {
      result.current.recordTypoForCurrentItem();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.sessionSummary.itemsReviewed).toBe(0);
    expect(result.current.sessionSummary.domainCounts.kanji).toBe(0);
  });
});
