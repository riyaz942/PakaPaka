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

jest.mock('@/data/user/goalRingRepository', () => ({
  resolveDailyGoalTarget: () => 15,
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getSessionIntensity: (...args: unknown[]) => mockGetSessionIntensity(...args),
}));

jest.mock('@/data/user/streakRepository', () => ({
  recordReviewAndUpdateStreak: (...args: unknown[]) => mockRecordReviewAndUpdateStreak(...args),
}));

const mockRecordOutcome = jest.fn();

jest.mock('@/data/user/weaknessRepository', () => ({
  recordOutcome: (...args: unknown[]) => mockRecordOutcome(...args),
}));

const mockAddSynonym = jest.fn();

jest.mock('@/data/user/userSynonymRepository', () => ({
  addSynonym: (...args: unknown[]) => mockAddSynonym(...args),
}));

const NOW = '2026-06-27T10:00:00.000Z';

function makeReviewItem(id: string, itemType: ReviewItem['itemType'] = 'kanji'): ReviewItem {
  return {
    itemId: id,
    itemType,
    primaryForm: `kanji-${id}`,
    displayMeaning: `meaning-${id}`,
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
      learningSteps: 0,
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
    mockRecordOutcome.mockReset();
    mockRecordOutcome.mockReturnValue({ ok: true, value: undefined });
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
    mockAddSynonym.mockReset();
    mockAddSynonym.mockReturnValue({ ok: true, value: undefined });
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

  it('increases cognitive load by the same amount for an incorrect grade as correct', async () => {
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

    expect(incorrectResult.current.cognitiveLoadPercent).toBe(correctPercent);
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

  it('records a stage demotion in the summary, and nothing on a correct answer', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(3),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // Again on a guru item drops it back to apprentice.
    act(() => {
      result.current.gradeCurrentItem(1);
    });
    expect(result.current.sessionSummary.slipped).toEqual([
      { itemId: '1', primaryForm: 'kanji-1', from: 'guru', to: 'apprentice' },
    ]);

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('2');
    });

    act(() => {
      result.current.gradeCurrentItem(3);
    });
    expect(result.current.sessionSummary.slipped).toHaveLength(1);
  });

  it('reports the goal percent this session alone contributed', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    // Today already carries load from an earlier session.
    mockGetDailyLoad.mockReturnValue({ date: '2026-06-28', load: 6, threshold: 30 });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // The earlier load counts toward the ring but not toward this session.
    expect(result.current.sessionSummary.goalDeltaPercent).toBe(0);
    const before = result.current.sessionSummary.goalPercent;
    expect(before).toBeGreaterThan(0);

    act(() => {
      result.current.gradeCurrentItem(3);
    });

    await waitFor(() => {
      expect(result.current.sessionSummary.goalDeltaPercent).toBeGreaterThan(0);
    });
    expect(result.current.sessionSummary.goalPercent).toBeGreaterThan(before);
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

  it('re-queues an incorrect item at the end and completes only after it is answered correctly', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(3),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // Item 1 incorrect → should reappear after items 2 and 3.
    act(() => {
      result.current.gradeCurrentItem(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.currentItem?.itemId).toBe('2');

    act(() => {
      result.current.gradeCurrentItem(3);
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.gradeCurrentItem(3);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Retry of item 1, not completion.
    expect(result.current.isComplete).toBe(false);
    expect(result.current.currentItem?.itemId).toBe('1');

    // Incorrect again → re-queued again.
    act(() => {
      result.current.gradeCurrentItem(1);
    });
    expect(result.current.isComplete).toBe(false);
    expect(result.current.currentItem?.itemId).toBe('1');

    act(() => {
      result.current.gradeCurrentItem(3);
    });
    expect(result.current.isComplete).toBe(true);
  });

  it('accepts a synonym added this session on the same item\'s same-session retry', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(2),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // Item 1 answered incorrectly, then the user accepts their own answer
    // before tapping Continue (mirrors the IncorrectReveal "Accept as my
    // answer" flow, which grades on Continue, after this call).
    act(() => {
      const outcome = result.current.addSynonymForCurrentItem('my-answer');
      expect(outcome).toEqual({ status: 'added' });
    });

    expect(result.current.currentItem?.answerKey.acceptedReadings).toContain('my-answer');

    act(() => {
      result.current.gradeCurrentItem(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Item 2, then item 1's same-session retry.
    expect(result.current.currentItem?.itemId).toBe('2');
    act(() => {
      result.current.gradeCurrentItem(3);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.currentItem?.itemId).toBe('1');
    // The synonym added before Continue must still be accepted on this
    // same-session retry — not deferred to the next day's queue build.
    expect(result.current.currentItem?.answerKey.acceptedReadings).toContain('my-answer');
  });

  it('writes the FSRS grade and side effects once, on the first attempt only', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(1),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // First attempt incorrect → grade written once.
    act(() => {
      result.current.gradeCurrentItem(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
    expect(mockAddDailyLoad).toHaveBeenCalledTimes(1);
    expect(result.current.sessionSummary.itemsReviewed).toBe(1);
    expect(result.current.sessionSummary.correctCount).toBe(0);

    // Retry answered correctly → nothing new is written or counted.
    expect(result.current.currentItem?.itemId).toBe('1');
    act(() => {
      result.current.gradeCurrentItem(3);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
    expect(mockAddDailyLoad).toHaveBeenCalledTimes(1);
    expect(mockApplyBoosts).not.toHaveBeenCalled();
    expect(result.current.sessionSummary.itemsReviewed).toBe(1);
    expect(result.current.sessionSummary.correctCount).toBe(0);
    expect(result.current.isComplete).toBe(true);
  });

  it('does not record a typo outcome for a retry card', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(1),
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
      result.current.gradeCurrentItem(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Now on the retry card — a typo must not be recorded again.
    const callsBefore = mockAddDailyLoad.mock.calls.length;
    act(() => {
      result.current.recordTypoForCurrentItem();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockAddDailyLoad.mock.calls.length).toBe(callsBefore);
  });

  it('advances progress only on correct answers so it never moves backwards', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(3),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.gradeCurrentItem(1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Incorrect does not retire the item — progress holds.
    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.gradeCurrentItem(3);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.currentIndex).toBe(1);
  });

  it('peekStageTransition reflects the grade and is null for retries', async () => {
    const db = await openDatabaseAsync('user.db');
    const wrapper = await createWrapper(db);

    mockUseReviewQueue.mockReturnValue({
      queue: makeQueue(1),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      queueBuildMs: 12,
    });

    const { result } = renderHook(() => useReviewSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentItem?.itemId).toBe('1');
    });

    // Fixture is a guru card (stability 5 puts a graded card in apprentice
    // territory on Again via Relearning).
    const dropped = result.current.peekStageTransition(1);
    expect(dropped).toEqual({ from: 'guru', to: 'apprentice' });

    act(() => {
      result.current.gradeCurrentItem(1);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Retry card — nothing is written, so no transition to show.
    expect(result.current.currentItem?.itemId).toBe('1');
    expect(result.current.peekStageTransition(3)).toBeNull();
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

  describe('two-card kanji worst-of-both grading (Story 1.1, FR83)', () => {
    // A kanji pair: meaning card + on'yomi reading card sharing itemId/srsState.
    function makeTwoCardPair(id: string): [ReviewItem, ReviewItem] {
      const base = makeReviewItem(id);
      return [
        { ...base, promptType: 'meaning', isTwoCardItem: true },
        { ...base, promptType: 'reading', isTwoCardItem: true },
      ];
    }

    function mockPairQueue(id = 'k1') {
      const [meaningCard, readingCard] = makeTwoCardPair(id);
      mockUseReviewQueue.mockReturnValue({
        queue: [meaningCard, readingCard],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        queueBuildMs: 12,
      });
    }

    it('both cards correct → exactly one FSRS write, load/domain/correct counted once', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      // First card terminal — nothing item-level fires yet.
      expect(mockUpsertSrsState).not.toHaveBeenCalled();
      expect(mockAddDailyLoad).not.toHaveBeenCalled();
      expect(result.current.sessionSummary.itemsReviewed).toBe(0);
      expect(result.current.currentItem?.promptType).toBe('reading');

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      expect(mockAddDailyLoad).toHaveBeenCalledTimes(1);
      expect(mockClearBoosts).toHaveBeenCalledTimes(1);
      expect(result.current.sessionSummary.domainCounts.kanji).toBe(1);
      expect(result.current.sessionSummary.itemsReviewed).toBe(1);
      expect(result.current.sessionSummary.correctCount).toBe(1);
      expect(result.current.isComplete).toBe(true);
    });

    it('one card incorrect → single write with worst-of-both Again, only the failed card retries', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      // Meaning fails, reading succeeds.
      act(() => {
        result.current.gradeCurrentItem(1);
      });
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      // Worst-of-both: Again → the written state reflects a lapse (Relearning).
      const writtenState = mockUpsertSrsState.mock.calls[0][1];
      expect(writtenState.fsrsState).toBe('relearning');
      // Again → no related-item boosts, no correctCount.
      expect(mockApplyBoosts).not.toHaveBeenCalled();
      expect(result.current.sessionSummary.correctCount).toBe(0);

      // Only the failed meaning card is re-asked.
      expect(result.current.isComplete).toBe(false);
      expect(result.current.currentItem?.promptType).toBe('meaning');
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });
      // Retry is pedagogical — still exactly one FSRS write.
      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      expect(result.current.isComplete).toBe(true);
    });

    it('both cards incorrect → one Again write and both cards re-queued', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      act(() => {
        result.current.gradeCurrentItem(1);
      });
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        result.current.gradeCurrentItem(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      // Both cards come back as retries.
      expect(result.current.currentItem?.promptType).toBe('meaning');
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      expect(result.current.currentItem?.promptType).toBe('reading');
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      expect(result.current.isComplete).toBe(true);
      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
    });

    it('records weakness per terminal card with that card\'s promptType', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        result.current.gradeCurrentItem(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      const outcomes = mockRecordOutcome.mock.calls.map(([, outcome]) => outcome);
      expect(outcomes).toEqual([
        { itemId: 'k1', result: 'correct', promptType: 'meaning' },
        { itemId: 'k1', result: 'incorrect', promptType: 'reading' },
      ]);
    });

    it('advances header progress per completed card, not per completed pair', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      expect(result.current.totalItems).toBe(2);
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      // First card of the pair already moves the header (no stall).
      expect(result.current.currentIndex).toBe(1);
      act(() => {
        result.current.gradeCurrentItem(3);
      });
      expect(result.current.currentIndex).toBe(2);
    });

    it('peekStageTransition is null until the pair-completing card, then peeks worst-of-both', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      // First card: the item grade is unknown — nothing to peek.
      expect(result.current.peekStageTransition(1)).toBeNull();

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      // Completing card: Again on this card drags the guru fixture down.
      expect(result.current.peekStageTransition(1)).toEqual({
        from: 'guru',
        to: 'apprentice',
      });
      // A Good completion peeks combined(3,3)=3 — an upward move, never the
      // Again drop this card alone couldn't decide.
      const goodPeek = result.current.peekStageTransition(3);
      expect(goodPeek?.from).toBe('guru');
      expect(goodPeek?.to).not.toBe('apprentice');
    });

    it('single-card items keep the immediate-grade path (regression)', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockUseReviewQueue.mockReturnValue({
        queue: [makeReviewItem('v1', 'vocabulary')],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        queueBuildMs: 12,
      });

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.itemId).toBe('v1');
      });

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      expect(mockRecordOutcome).toHaveBeenCalledTimes(1);
      expect(result.current.sessionSummary.itemsReviewed).toBe(1);
      expect(result.current.isComplete).toBe(true);
    });

    it('ignores a duplicate gradeCurrentItem on the first card of an incomplete pair', async () => {
      const db = await openDatabaseAsync('user.db');
      const wrapper = await createWrapper(db);
      mockPairQueue();

      const { result } = renderHook(() => useReviewSession(), { wrapper });
      await waitFor(() => {
        expect(result.current.currentItem?.promptType).toBe('meaning');
      });

      act(() => {
        result.current.gradeCurrentItem(3);
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      // Second call must not skip the reading partner.
      expect(result.current.currentItem?.promptType).toBe('reading');
      expect(mockUpsertSrsState).not.toHaveBeenCalled();
      expect(mockRecordOutcome).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.gradeCurrentItem(3);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockUpsertSrsState).toHaveBeenCalledTimes(1);
      expect(result.current.isComplete).toBe(true);
    });
  });
});
