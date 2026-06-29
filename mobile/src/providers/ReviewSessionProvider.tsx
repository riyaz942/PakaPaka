import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { COGNITIVE_LOAD_HISTORY_WINDOW, MAX_PREFETCH } from '@/config/constants';
import { computeLoadIncrement, computeLoadPercent } from '@/core/cognitive-load/loadTracker';
import { computeThreshold } from '@/core/cognitive-load/thresholdCalculator';
import { computeBoosts } from '@/core/srs/boostEngine';
import { gradeItem } from '@/core/srs/fsrsScheduler';
import type { ReviewGrade, ReviewItem, SRSState } from '@/core/srs/srs.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useReviewQueue } from '@/data/hooks/useReviewQueue';
import {
  addDailyLoad,
  getDailyLoad,
  getRecentDailyLoads,
  todayKey,
} from '@/data/user/cognitiveLoadRepository';
import { getSessionIntensity } from '@/data/user/preferencesRepository';
import { applyBoosts } from '@/data/user/relatedItemBoostRepository';
import { recordReviewAndUpdateStreak } from '@/data/user/streakRepository';
import { recordOutcome } from '@/data/user/weaknessRepository';
import { upsertSrsState } from '@/data/user/srsStateRepository';
import type { AppError } from '@/types/result.types';

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

  useEffect(() => {
    setCurrentIndex(0);
    setSessionLoad(0);
    loadInitialized.current = false;
  }, [queue]);

  useEffect(() => {
    if (loadInitialized.current || isLoading) return;
    loadInitialized.current = true;

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
    const today = todayKey();
    const result = recordReviewAndUpdateStreak(userDb, today);
    if (!result.ok && __DEV__) {
      console.warn('[ReviewSession] streak update failed', result.error);
    }
  }, [isComplete, userDb]);

  const prefetchBuffer = queue.slice(
    currentIndex + 1,
    currentIndex + 1 + MAX_PREFETCH,
  );

  const gradeCurrentItem = useCallback(
    (grade: ReviewGrade) => {
      if (!currentItem || isGrading.current) return;

      isGrading.current = true;
      const nextState = gradeItem(currentItem.srsState, grade, new Date());
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
