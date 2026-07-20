import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { MAX_PREFETCH } from '@/config/constants';
import { normalizeMeaning } from '@/core/answer/meaningEvaluator';
import { normalizeKana } from '@/core/answer/readingEvaluator';
import { computeLoadIncrement, computeLoadPercent } from '@/core/cognitive-load/loadTracker';
import { computeBoosts } from '@/core/srs/boostEngine';
import { gradeItem } from '@/core/srs/fsrsScheduler';
import { combinePairGrades } from '@/core/srs/pairGrading';
import type { ReviewGrade, ReviewItem, SRSState, StageTransition } from '@/core/srs/srs.types';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useReviewQueue } from '@/data/hooks/useReviewQueue';
import { addDailyLoad, getDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { resolveDailyGoalTarget } from '@/data/user/goalRingRepository';
import { applyBoosts, clearBoosts } from '@/data/user/relatedItemBoostRepository';
import { recordReviewAndUpdateStreak } from '@/data/user/streakRepository';
import { recordOutcome } from '@/data/user/weaknessRepository';
import { upsertSrsState } from '@/data/user/srsStateRepository';
import { addSynonym } from '@/data/user/userSynonymRepository';
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
  /** Count of cards retired (answered correctly at least once). Never decreases. */
  currentIndex: number;
  totalItems: number;
  /** Position in the working queue (including retries). Increments on every grade — key card resets on this. */
  cursor: number;
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
   * Stage movement the given grade would produce for the current card, or null
   * when the stage wouldn't change or the card is a retry (retries write nothing).
   */
  peekStageTransition: (grade: ReviewGrade) => StageTransition | null;
  /**
   * Record a typo outcome for the current item without advancing (non-terminal).
   * Called from the typo branch in review/index.tsx which never calls gradeCurrentItem.
   */
  recordTypoForCurrentItem: () => void;
  /**
   * Persist a user-added accepted answer for the current item (picked up on the
   * item's next queue build — never retroactively changes a recorded outcome).
   * Returns 'collision' (without saving) when the answer is already accepted by
   * a different item in this queue, unless `force` is set.
   */
  addSynonymForCurrentItem: (
    answerText: string,
    options?: { force?: boolean },
  ) => AddSynonymOutcome;
};

export type AddSynonymOutcome =
  | { status: 'added' }
  | { status: 'collision'; collidesWith: string }
  | { status: 'error' };

/** A card in the session working queue. Retries are pedagogical re-asks: they write nothing. */
type QueueEntry = { item: ReviewItem; isRetry: boolean };

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
  const [cursor, setCursor] = useState(0);
  // Incorrect cards re-asked later in the session. Always appended at the tail
  // of the working queue so the maximum number of other items intervene before
  // the re-ask (WaniKani-style: don't let the user pattern-match off the reveal).
  const [retryItems, setRetryItems] = useState<ReviewItem[]>([]);
  // Cards answered correctly at least once — drives header progress. Card-
  // scoped, not item-scoped, so a two-card kanji advances the header per card.
  const [retiredCount, setRetiredCount] = useState(0);
  const [baseLoad, setBaseLoad] = useState(0);
  const [sessionLoad, setSessionLoad] = useState(0);
  const thresholdRef = useRef(30);
  const loadInitialized = useRef(false);
  const isGrading = useRef(false);
  // Blocks a second gradeCurrentItem for the same working-queue entry before
  // React re-renders on cursor advance (e.g. double-tap Continue on incorrect).
  // Cleared when cursor moves; isGrading alone is insufficient on the incomplete
  // two-card path because that path never opens applyItemGrade's async latch.
  const gradedEntryKeyRef = useRef<string | null>(null);
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
  // First-attempt terminal grades per two-card kanji item, held until both the
  // meaning and reading cards are terminal — then a single worst-of-both FSRS
  // write fires (FR83). In-memory only; abandoning the session mid-pair writes
  // nothing, exactly like abandoning before a single card's first attempt.
  const pairGradesRef = useRef<Map<string, { meaning?: ReviewGrade; reading?: ReviewGrade }>>(
    new Map(),
  );

  useEffect(() => {
    setCursor(0);
    setRetryItems([]);
    setRetiredCount(0);
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
    pairGradesRef.current = new Map();
    gradedEntryKeyRef.current = null;
  }, [queue]);

  useEffect(() => {
    gradedEntryKeyRef.current = null;
  }, [cursor]);

  useEffect(() => {
    if (loadInitialized.current || isLoading) return;
    loadInitialized.current = true;
    sessionStartRef.current = Date.now();

    const today = todayKey();
    const daily = getDailyLoad(userDb, today);
    // Sticky daily goal — same denominator as the Home ring (FR55).
    thresholdRef.current = resolveDailyGoalTarget(userDb);
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
  // Working queue = first-attempt cards followed by retry cards. Retries are
  // derived state so the queue stays consistent with `queue` within a render.
  const workingQueue = useMemo<QueueEntry[]>(
    () => [
      ...queue.map((item) => ({ item, isRetry: false })),
      ...retryItems.map((item) => ({ item, isRetry: true })),
    ],
    [queue, retryItems],
  );
  const currentEntry = workingQueue[cursor] ?? null;
  const currentItem = currentEntry?.item ?? null;
  // The session completes only when the working queue — retries included — is
  // exhausted, i.e. every item has been answered correctly at least once.
  const isComplete =
    !isLoading && !error && totalItems > 0 && cursor >= workingQueue.length;

  useEffect(() => {
    if (!isComplete) return;
    if (durationSnapshotRef.current === null && sessionStartRef.current !== null) {
      const now = Date.now();
      durationSnapshotRef.current = now - sessionStartRef.current;
      sessionEndAtRef.current = now;
    }
  }, [isComplete]);

  const prefetchBuffer = workingQueue
    .slice(cursor + 1, cursor + 1 + MAX_PREFETCH)
    .map((entry) => entry.item);

  /**
   * Item-level grade application: the single FSRS write plus every once-per-item
   * side effect (boost consume, streak, related boosts, cognitive load, summary
   * counters). Single-card items call this on their first attempt; a two-card
   * kanji calls it exactly once, when the pair's worst-of-both grade is known.
   * Weakness is per terminal card, so pair completion passes recordWeakness: false.
   */
  const applyItemGrade = useCallback(
    (item: ReviewItem, grade: ReviewGrade, options: { recordWeakness: boolean }) => {
      isGrading.current = true;
      const nextState = gradeItem(item.srsState, grade, new Date());
      const outcomeResult: 'correct' | 'incorrect' = grade === 1 ? 'incorrect' : 'correct';
      const promptType = item.promptType;
      const itemId = item.itemId;

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
          if (grade !== 1 && item.relatedItems.length > 0) {
            const deltas = computeBoosts(item.relatedItems);
            const boostResult = applyBoosts(userDb, deltas);
            if (!boostResult.ok && __DEV__) {
              console.warn('[ReviewSession] boost persist failed', boostResult.error);
            }
          }

          if (options.recordWeakness) {
            // Weakness outcome recording — best-effort, never blocks or crashes.
            const weaknessResult = recordOutcome(userDb, {
              itemId,
              result: outcomeResult,
              promptType,
            });
            if (!weaknessResult.ok && __DEV__) {
              console.warn('[ReviewSession] weakness record failed', weaknessResult.error);
            }
          }

          const increment = computeLoadIncrement({
            itemType: item.itemType,
            stageLabel: item.srsState.srsStageLabel,
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

      domainCountsRef.current[item.itemType] += 1;
      if (outcomeResult === 'correct') {
        correctCountRef.current += 1;
      }
    },
    [userDb],
  );

  const gradeCurrentItem = useCallback(
    (grade: ReviewGrade) => {
      if (!currentEntry || isGrading.current) return;
      const entryKey = `${cursor}:${currentEntry.item.itemId}:${currentEntry.item.promptType}:${currentEntry.isRetry ? 'r' : 'f'}`;
      if (gradedEntryKeyRef.current === entryKey) return;
      gradedEntryKeyRef.current = entryKey;

      const currentItem = currentEntry.item;
      // grade === 1 (Again) → incorrect; anything else → correct.
      const outcomeResult: 'correct' | 'incorrect' = grade === 1 ? 'incorrect' : 'correct';

      // Retry cards are pedagogical only: the FSRS grade, weakness outcome,
      // cognitive load, boosts, and summary counters were all written on the
      // first attempt. Correct retires the card; incorrect re-queues it again.
      if (currentEntry.isRetry) {
        if (outcomeResult === 'correct') {
          setRetiredCount((count) => count + 1);
        } else {
          setRetryItems((items) => [...items, currentItem]);
        }
        setCursor((i) => i + 1);
        return;
      }

      // Per-card progress and retry: correct retires the card; incorrect
      // re-queues only this card (the pair's other card is unaffected).
      if (outcomeResult === 'correct') {
        setRetiredCount((count) => count + 1);
      } else {
        setRetryItems((items) => [...items, currentItem]);
      }

      if (currentItem.isTwoCardItem) {
        // Weakness is recorded per terminal card with that card's promptType,
        // so meaning-vs-reading weakness stays meaningful (Story 1.1).
        const itemId = currentItem.itemId;
        const promptType = currentItem.promptType;
        Promise.resolve()
          .then(() => {
            const weaknessResult = recordOutcome(userDb, {
              itemId,
              result: outcomeResult,
              promptType,
            });
            if (!weaknessResult.ok && __DEV__) {
              console.warn('[ReviewSession] weakness record failed', weaknessResult.error);
            }
          })
          .catch((cause) => {
            if (__DEV__) {
              console.warn('[ReviewSession] weakness write failed', cause);
            }
          });

        const entry = pairGradesRef.current.get(itemId) ?? {};
        entry[currentItem.promptType === 'meaning' ? 'meaning' : 'reading'] = grade;
        pairGradesRef.current.set(itemId, entry);

        if (entry.meaning !== undefined && entry.reading !== undefined) {
          pairGradesRef.current.delete(itemId);
          applyItemGrade(currentItem, combinePairGrades(entry.meaning, entry.reading), {
            recordWeakness: false,
          });
        }
        setCursor((i) => i + 1);
        return;
      }

      applyItemGrade(currentItem, grade, { recordWeakness: true });
      setCursor((i) => i + 1);
    },
    [applyItemGrade, currentEntry, cursor, userDb],
  );

  const peekStageTransition = useCallback(
    (grade: ReviewGrade): StageTransition | null => {
      if (!currentEntry || currentEntry.isRetry) return null;
      const item = currentEntry.item;
      let effectiveGrade = grade;
      if (item.isTwoCardItem) {
        // The item-level grade is unknown until both cards are terminal — only
        // the pair-completing card may peek, and it peeks the combined grade.
        const entry = pairGradesRef.current.get(item.itemId);
        const otherGrade = item.promptType === 'meaning' ? entry?.reading : entry?.meaning;
        if (otherGrade === undefined) return null;
        effectiveGrade = combinePairGrades(otherGrade, grade);
      }
      const from = item.srsState.srsStageLabel;
      const to = gradeItem(item.srsState, effectiveGrade, new Date()).srsStageLabel;
      return from === to ? null : { from, to };
    },
    [currentEntry],
  );

  /**
   * Record a typo for the current item without advancing.
   * The typo branch in review/index.tsx re-prompts and never calls gradeCurrentItem,
   * so we record the typo here separately.
   *
   * Rule: a typo followed by a correct retry records one typo + one correct.
   */
  const recordTypoForCurrentItem = useCallback(() => {
    // Retry cards record nothing — the item's outcomes were counted on first attempt.
    if (!currentEntry || currentEntry.isRetry) return;
    const itemId = currentEntry.item.itemId;
    const promptType = currentEntry.item.promptType;

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
  }, [currentEntry, userDb]);

  const addSynonymForCurrentItem = useCallback(
    (answerText: string, options?: { force?: boolean }): AddSynonymOutcome => {
      if (!currentEntry) return { status: 'error' };
      const item = currentEntry.item;
      const trimmed = answerText.trim();
      if (!trimmed) return { status: 'error' };

      const answerType = item.promptType === 'meaning' ? 'meaning' : 'reading';

      if (!options?.force) {
        // Guardrail: warn when the answer is already accepted by a *different*
        // item in this queue (会 and 合 must not both become "meet") — but
        // don't hard-block; the caller can retry with force.
        const normalize = answerType === 'meaning' ? normalizeMeaning : normalizeKana;
        const normalized = normalize(trimmed);
        for (const other of queue) {
          if (other.itemId === item.itemId) continue;
          const accepted =
            answerType === 'meaning'
              ? other.answerKey.acceptedMeanings
              : other.answerKey.acceptedReadings;
          if (accepted.some((candidate) => normalize(candidate) === normalized)) {
            return { status: 'collision', collidesWith: other.primaryForm };
          }
        }
      }

      const result = addSynonym(userDb, item.itemId, answerType, trimmed);
      return result.ok ? { status: 'added' } : { status: 'error' };
    },
    [currentEntry, queue, userDb],
  );

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
    currentIndex: retiredCount,
    totalItems,
    cursor,
    isLoading,
    isComplete,
    error,
    cognitiveLoadPercent,
    cognitiveLoadComplete,
    sessionSummary,
    snapshotSessionDuration,
    refetch,
    gradeCurrentItem,
    peekStageTransition,
    recordTypoForCurrentItem,
    addSynonymForCurrentItem,
  };

  return (
    <ReviewSessionContext.Provider value={value}>
      {children}
    </ReviewSessionContext.Provider>
  );
}
