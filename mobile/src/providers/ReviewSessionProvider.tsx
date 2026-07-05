import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { COGNITIVE_LOAD_HISTORY_WINDOW, MAX_PREFETCH } from '@/config/constants';
import { computeLoadIncrement, computeLoadPercent } from '@/core/cognitive-load/loadTracker';
import { computeThreshold } from '@/core/cognitive-load/thresholdCalculator';
import { computeBoosts } from '@/core/srs/boostEngine';
import { gradeItem } from '@/core/srs/fsrsScheduler';
import type { ReviewGrade, ReviewItem, SRSState } from '@/core/srs/srs.types';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useReviewQueue } from '@/data/hooks/useReviewQueue';
import {
  addDailyLoad,
  getDailyLoad,
  getRecentDailyLoads,
  todayKey,
} from '@/data/user/cognitiveLoadRepository';
import { getSessionIntensity } from '@/data/user/preferencesRepository';
import { applyBoosts, clearBoosts } from '@/data/user/relatedItemBoostRepository';
import { recordReviewAndUpdateStreak } from '@/data/user/streakRepository';
import { recordOutcome } from '@/data/user/weaknessRepository';
import { upsertSrsState } from '@/data/user/srsStateRepository';
import type { AppError } from '@/types/result.types';

type SessionSummary = {
  domainCounts: Record<ItemType, number>;
  itemsReviewed: number;
  correctCount: number;
  durationMs: number;
  sessionEndAt: number;
};

type ReviewSessionState = {
  currentItem: ReviewItem | null;
  prefetchBuffer: ReviewItem[];
  currentIndex: number;
  totalItems: number;
  isLoading: boolean;
  isComplete: boolean;
  error: AppError | null;
  cognitiveLoadPercent: number;
  cognitiveLoadComplete: boolean;
  sessionSummary: SessionSummary;
  snapshotSessionDuration: () => void;
  refetch: () => void;
  gradeCurrentItem: (grade: ReviewGrade) => void;
  /**
   * Record a typo outcome for the current item without advancing (non-terminal).
   * Called from the typo branch in review/index.tsx which never calls gradeCurrentItem.
   */
  recordTypoForCurrentItem: () => void;
};

const ReviewSessionContext = createContext<ReviewSessionState | null>(null);

export function useReviewSession(): ReviewSessionState {
  const ctx = useContext(ReviewSessionContext);
  if (!ctx) {
    throw new Error('useReviewSession must be used inside ReviewSessionProvider');
  }
  return ctx;
}

type Props = {
  children: React.ReactNode;
};

export function ReviewSessionProvider({ children }: Props) {
  const { userDb } = useDatabase();
  const { queue, isLoading, error, refetch } = useReviewQueue();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [baseLoad, setBaseLoad] = useState(0);
  const [sessionLoad, setSessionLoad] = useState(0);
  const thresholdRef = useRef(30);
  const loadInitialized = useRef(false);
  const isGrading = useRef(false);
  const pendingWrites = useRef<SRSState[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const durationSnapshotRef = useRef<number | null>(null);
  const sessionEndAtRef = useRef<number | null>(null);
  const domainCountsRef = useRef<Record<ItemType, number>>({
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    grammar: 0,
  });
  // Additive counter for shadow-mode retention rate (Epic 8). Never read by the
  // review queue builder, FSRS scheduler, or gradeCurrentItem's scheduling logic.
  const correctCountRef = useRef(0);
  // Streak credit is earned by the first graded item of a session (any review
  // activity that day counts), not by finishing the whole queue.
  const streakRecordedRef = useRef(false);

  useEffect(() => {
    setCurrentIndex(0);
    setSessionLoad(0);
    loadInitialized.current = false;
    sessionStartRef.current = null;
    durationSnapshotRef.current = null;
    sessionEndAtRef.current = null;
    domainCountsRef.current = {
      radical: 0,
      kanji: 0,
      vocabulary: 0,
      grammar: 0,
    };
    correctCountRef.current = 0;
    streakRecordedRef.current = false;
  }, [queue]);

  useEffect(() => {
    if (loadInitialized.current || isLoading) return;
    loadInitialized.current = true;
    sessionStartRef.current = Date.now();

    const today = todayKey();
    const daily = getDailyLoad(userDb, today);
    const recentLoads = getRecentDailyLoads(userDb, today, COGNITIVE_LOAD_HISTORY_WINDOW);
    const intensity = getSessionIntensity(userDb) ?? 'relaxed';
    thresholdRef.current = computeThreshold({ intensity, recentLoads });
    setBaseLoad(daily?.load ?? 0);
  }, [userDb, isLoading]);

  useEffect(() => {
    return () => {
      for (const state of pendingWrites.current) {
        upsertSrsState(userDb, state);
      }
    };
  }, [userDb]);

  const totalItems = queue.length;
  const currentItem = queue[currentIndex] ?? null;
  const isComplete = !isLoading && !error && totalItems > 0 && currentIndex >= totalItems;

  useEffect(() => {
    if (!isComplete) return;
    if (durationSnapshotRef.current === null && sessionStartRef.current !== null) {
      const now = Date.now();
      durationSnapshotRef.current = now - sessionStartRef.current;
      sessionEndAtRef.current = now;
    }
  }, [isComplete]);

  const prefetchBuffer = queue.slice(
    currentIndex + 1,
    currentIndex + 1 + MAX_PREFETCH,
  );

  const gradeCurrentItem = useCallback(
    (grade: ReviewGrade) => {
      if (!currentItem || isGrading.current) return;

      isGrading.current = true;
      const nextState = gradeItem(currentItem.srsState, grade, new Date());
      const gradedItemType = currentItem.itemType;
      // grade === 1 (Again) → incorrect; anything else → correct.
      const outcomeResult: 'correct' | 'incorrect' = grade === 1 ? 'incorrect' : 'correct';
      const promptType = currentItem.promptType;
      const itemId = currentItem.itemId;

      Promise.resolve()
        .then(() => {
          const result = upsertSrsState(userDb, nextState);
          if (!result.ok) {
            pendingWrites.current.push(nextState);
          } else if (pendingWrites.current.length > 0) {
            const retries = [...pendingWrites.current];
            pendingWrites.current = [];
            for (const state of retries) {
              const retryResult = upsertSrsState(userDb, state);
              if (!retryResult.ok) {
                pendingWrites.current.push(state);
              }
            }
          }

          // The item has now actually been reviewed — consume any reinforcement
          // boost it carried into this queue (boosts are cleared on grade, not
          // at queue-build time, so backing out of a session preserves them).
          const clearBoostResult = clearBoosts(userDb, [itemId]);
          if (!clearBoostResult.ok && __DEV__) {
            console.warn('[ReviewSession] boost clear failed', clearBoostResult.error);
          }

          // Streak credit: first graded item of the session counts as review
          // activity for today, even if the queue is never finished.
          if (!streakRecordedRef.current) {
            streakRecordedRef.current = true;
            const streakResult = recordReviewAndUpdateStreak(userDb, todayKey());
            if (!streakResult.ok && __DEV__) {
              console.warn('[ReviewSession] streak update failed', streakResult.error);
            }
          }

          // Related-item boosts on any non-Again grade (correct answers only).
          if (grade !== 1 && currentItem.relatedItems.length > 0) {
            const deltas = computeBoosts(currentItem.relatedItems);
            const boostResult = applyBoosts(userDb, deltas);
            if (!boostResult.ok && __DEV__) {
              console.warn('[ReviewSession] boost persist failed', boostResult.error);
            }
          }

          // Weakness outcome recording — best-effort, never blocks or crashes.
          const weaknessResult = recordOutcome(userDb, {
            itemId,
            result: outcomeResult,
            promptType,
          });
          if (!weaknessResult.ok && __DEV__) {
            console.warn('[ReviewSession] weakness record failed', weaknessResult.error);
          }

          const increment = computeLoadIncrement({
            itemType: currentItem.itemType,
            stageLabel: currentItem.srsState.srsStageLabel,
            outcome: outcomeResult,
          });
          const loadResult = addDailyLoad(userDb, {
            date: todayKey(),
            increment,
            threshold: thresholdRef.current,
          });
          if (!loadResult.ok && __DEV__) {
            console.warn('[ReviewSession] cognitive load persist failed', loadResult.error);
          }
          setSessionLoad((load) => load + increment);
        })
        .catch((cause) => {
          pendingWrites.current.push(nextState);
          if (__DEV__) {
            console.warn('[ReviewSession] grade persist failed', cause);
          }
        })
        .finally(() => {
          isGrading.current = false;
        });

      domainCountsRef.current[gradedItemType] += 1;
      if (outcomeResult === 'correct') {
        correctCountRef.current += 1;
      }

      setCurrentIndex((i) => i + 1);
    },
    [currentItem, userDb],
  );

  /**
   * Record a typo for the current item without advancing.
   * The typo branch in review/index.tsx re-prompts and never calls gradeCurrentItem,
   * so we record the typo here separately.
   *
   * Rule: a typo followed by a correct retry records one typo + one correct.
   */
  const recordTypoForCurrentItem = useCallback(() => {
    if (!currentItem) return;
    const itemId = currentItem.itemId;
    const promptType = currentItem.promptType;

    Promise.resolve()
      .then(() => {
        const weaknessResult = recordOutcome(userDb, {
          itemId,
          result: 'typo',
          promptType,
        });
        if (!weaknessResult.ok && __DEV__) {
          console.warn('[ReviewSession] weakness typo record failed', weaknessResult.error);
        }
      })
      .catch((cause) => {
        if (__DEV__) {
          console.warn('[ReviewSession] weakness typo write failed', cause);
        }
      });
  }, [currentItem, userDb]);

  const totalLoad = baseLoad + sessionLoad;
  const cognitiveLoadPercent = computeLoadPercent(totalLoad, thresholdRef.current);
  const cognitiveLoadComplete = cognitiveLoadPercent >= 100;

  const domainCounts = domainCountsRef.current;
  const itemsReviewed =
    domainCounts.radical +
    domainCounts.kanji +
    domainCounts.vocabulary +
    domainCounts.grammar;
  const durationMs =
    durationSnapshotRef.current ??
    (sessionStartRef.current !== null ? Date.now() - sessionStartRef.current : 0);

  const snapshotSessionDuration = useCallback(() => {
    if (durationSnapshotRef.current !== null || sessionStartRef.current === null) return;
    const now = Date.now();
    durationSnapshotRef.current = now - sessionStartRef.current;
    sessionEndAtRef.current = now;
  }, []);

  const sessionSummary: SessionSummary = {
    domainCounts: { ...domainCounts },
    itemsReviewed,
    correctCount: correctCountRef.current,
    durationMs,
    sessionEndAt: sessionEndAtRef.current ?? Date.now(),
  };

  const value: ReviewSessionState = {
    currentItem,
    prefetchBuffer,
    currentIndex,
    totalItems,
    isLoading,
    isComplete,
    error,
    cognitiveLoadPercent,
    cognitiveLoadComplete,
    sessionSummary,
    snapshotSessionDuration,
    refetch,
    gradeCurrentItem,
    recordTypoForCurrentItem,
  };

  return (
    <ReviewSessionContext.Provider value={value}>
      {children}
    </ReviewSessionContext.Provider>
  );
}
