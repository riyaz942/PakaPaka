import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { MAX_PREFETCH } from '@/config/constants';
import { computeBoosts } from '@/core/srs/boostEngine';
import { gradeItem } from '@/core/srs/fsrsScheduler';
import type { ReviewGrade, ReviewItem, SRSState } from '@/core/srs/srs.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useReviewQueue } from '@/data/hooks/useReviewQueue';
import { applyBoosts } from '@/data/user/relatedItemBoostRepository';
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
  refetch: () => void;
  gradeCurrentItem: (grade: ReviewGrade) => void;
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
  const isGrading = useRef(false);
  const pendingWrites = useRef<SRSState[]>([]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [queue]);

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

  const prefetchBuffer = queue.slice(
    currentIndex + 1,
    currentIndex + 1 + MAX_PREFETCH,
  );

  const gradeCurrentItem = useCallback(
    (grade: ReviewGrade) => {
      if (!currentItem || isGrading.current) return;

      isGrading.current = true;
      const nextState = gradeItem(currentItem.srsState, grade, new Date());

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

  const value: ReviewSessionState = {
    currentItem,
    prefetchBuffer,
    currentIndex,
    totalItems,
    isLoading,
    isComplete,
    error,
    refetch,
    gradeCurrentItem,
  };

  return (
    <ReviewSessionContext.Provider value={value}>
      {children}
    </ReviewSessionContext.Provider>
  );
}
