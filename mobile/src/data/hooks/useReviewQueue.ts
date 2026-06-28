import { useCallback, useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import { QUEUE_FETCH_LIMIT } from '@/config/constants';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type { ReinforcementSrsSnapshot } from '@/core/content/content.types';
import { resolveReinforcement } from '@/core/content/reinforcementResolver';
import type { ReviewAnswerKey, ReviewItem, SRSState } from '@/core/srs/srs.types';
import { buildReviewQueue } from '@/core/srs/queueBuilder';
import type { QueueInputItem } from '@/core/srs/queueBuilder';
import {
  getItemById,
  getRelatedItemsForItems,
  getRequiredParentsForItems,
  getAcceptedAnswers,
  getKanjiReadings,
  getGrammarRule,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getPersonalMnemonic } from '@/data/user/mnemonicRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { clearBoosts, getBoosts } from '@/data/user/relatedItemBoostRepository';
import { getWeaknessBiasEnabled } from '@/data/user/preferencesRepository';
import { getWeaknessScores } from '@/data/user/weaknessRepository';
import {
  getDueSrsStates,
  getSrsStatesForItems,
  seedMissingSrsStatesForInProgress,
} from '@/data/user/srsStateRepository';
import type { AppError } from '@/types/result.types';

type UseReviewQueueResult = {
  queue: ReviewItem[];
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
  queueBuildMs: number | null;
};

function buildAnswerKey(
  curriculumDb: SQLiteDatabase,
  itemId: string,
  itemType: 'radical' | 'kanji' | 'vocabulary' | 'grammar',
): ReviewAnswerKey {
  const acceptedAnswers = getAcceptedAnswers(curriculumDb, itemId);

  const acceptedMeanings = acceptedAnswers
    .filter((a) => a.answerType === 'meaning')
    .map((a) => a.answerText);

  let acceptedReadings = acceptedAnswers
    .filter((a) => a.answerType === 'reading' || a.answerType === 'production')
    .map((a) => a.answerText);

  if (itemType === 'kanji') {
    const kanjiReadings = getKanjiReadings(curriculumDb, itemId).map((r) => r.reading);
    acceptedReadings = [...new Set([...acceptedReadings, ...kanjiReadings])];
  }

  let grammar: ReviewAnswerKey['grammar'];
  if (itemType === 'grammar') {
    const rule = getGrammarRule(curriculumDb, itemId);
    if (rule) {
      grammar = {
        structure: rule.structure,
        conjugationRules: rule.conjugationRules,
        acceptedForms: rule.acceptedForms,
      };
    }
  }

  return { acceptedMeanings, acceptedReadings, grammar };
}

function getInProgressItemIds(userDb: import('expo-sqlite').SQLiteDatabase): string[] {
  const rows = userDb.getAllSync<{ item_id: number }>(
    `SELECT item_id FROM item_study_status WHERE status = 'in_progress'`,
  );
  return rows.map((row) => String(row.item_id));
}

function toReinforcementSnapshot(state: SRSState): ReinforcementSrsSnapshot {
  return {
    srsStageLabel: state.srsStageLabel,
    updatedAt: state.updatedAt,
    fsrsState: state.fsrsState,
    reps: state.reps,
  };
}

export function useReviewQueue(): UseReviewQueueResult {
  const { curriculumDb, userDb } = useDatabase();
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [queueBuildMs, setQueueBuildMs] = useState<number | null>(null);
  const [buildCount, setBuildCount] = useState(0);

  const buildQueue = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const t0 = Date.now();

      const inProgressIds = getInProgressItemIds(userDb);
      if (inProgressIds.length > 0) {
        const seedResult = seedMissingSrsStatesForInProgress(userDb, inProgressIds);
        if (!seedResult.ok) {
          setError(seedResult.error);
          setQueue([]);
          setIsLoading(false);
          return;
        }
      }

      const now = new Date();
      const dueSrsStates = getDueSrsStates(userDb, now, QUEUE_FETCH_LIMIT);

      if (dueSrsStates.length === 0) {
        const elapsed = Date.now() - t0;
        setQueueBuildMs(elapsed);
        setQueue([]);
        setIsLoading(false);
        return;
      }

      const itemIds = dueSrsStates.map((s) => s.itemId);

      const parentsMap = getRequiredParentsForItems(curriculumDb, itemIds);
      const relatedItemsMap = getRelatedItemsForItems(curriculumDb, itemIds);
      const boostMap = getBoosts(userDb, itemIds);
      // Read weakness bias preference and scores in one batched query (mirrors getBoosts).
      const weaknessBiasEnabled = getWeaknessBiasEnabled(userDb);
      const weaknessScoreMap = weaknessBiasEnabled ? getWeaknessScores(userDb, itemIds) : new Map<string, number>();

      const allRelatedIds = [
        ...new Set(
          Array.from(relatedItemsMap.values())
            .flat()
            .map((r) => r.id),
        ),
      ];
      const relatedSrsMap = getSrsStatesForItems(userDb, allRelatedIds);

      const allParentIds = Array.from(parentsMap.values())
        .flat()
        .map((p) => p.id);
      const uniqueParentIds = [...new Set(allParentIds)];
      const parentStatuses = listStudyStatusesForItems(userDb, uniqueParentIds);
      const studyStatusMap = listStudyStatusesForItems(userDb, itemIds);

      const queueInputs: QueueInputItem[] = [];
      const queuedItemIds: string[] = [];
      for (const srsState of dueSrsStates) {
        const curriculumItem = getItemById(curriculumDb, srsState.itemId);
        if (!curriculumItem) {
          if (__DEV__) {
            console.warn(
              `[ReviewQueue] Skipping due SRS item ${srsState.itemId}: no curriculum row`,
            );
          }
          continue;
        }

        const parents = parentsMap.get(srsState.itemId) ?? [];
        const studyStatus = studyStatusMap.get(srsState.itemId) ?? null;

        if (!isItemUnlocked(parents, parentStatuses)) continue;

        const relatedItems = relatedItemsMap.get(srsState.itemId) ?? [];
        const srsSnapshotMap = new Map<string, ReinforcementSrsSnapshot | null>();
        for (const related of relatedItems) {
          const relatedSrs = relatedSrsMap.get(related.id);
          srsSnapshotMap.set(related.id, relatedSrs ? toReinforcementSnapshot(relatedSrs) : null);
        }

        const reinforcementLinks = resolveReinforcement(
          { itemId: srsState.itemId, itemType: curriculumItem.itemType },
          relatedItems,
          srsSnapshotMap,
          { now },
        );

        const personalMnemonic = getPersonalMnemonic(userDb, srsState.itemId);
        const answerKey = buildAnswerKey(curriculumDb, srsState.itemId, curriculumItem.itemType);

        queueInputs.push({
          srsState,
          curriculumItem,
          parents,
          parentStatuses,
          studyStatus,
          personalMnemonic,
          answerKey,
          boost: boostMap.get(srsState.itemId) ?? 0,
          relatedItems,
          reinforcementLink: reinforcementLinks[0] ?? null,
        });
        queuedItemIds.push(srsState.itemId);
      }

      const built = buildReviewQueue(queueInputs, {
        now,
        weaknessScores: weaknessScoreMap,
        weaknessBiasEnabled,
      });
      const elapsed = Date.now() - t0;

      if (__DEV__ && elapsed > 100) {
        console.warn(`[ReviewQueue] queueBuildMs=${elapsed}ms exceeds 100ms budget`);
      }

      // Consume boosts only for items that actually entered the queue (unlocked).
      const consumedBoostIds = queuedItemIds.filter((id) => (boostMap.get(id) ?? 0) > 0);
      if (consumedBoostIds.length > 0) {
        const clearResult = clearBoosts(userDb, consumedBoostIds);
        if (!clearResult.ok && __DEV__) {
          console.warn('[ReviewQueue] Failed to clear consumed boosts', clearResult.error);
        }
      }

      setQueueBuildMs(elapsed);
      setQueue(built);
    } catch (cause) {
      setError({
        code: 'queue_build_failed',
        message: 'Failed to build review queue',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb]);

  useEffect(() => {
    buildQueue();
  }, [buildQueue, buildCount]);

  const refetch = useCallback(() => {
    setBuildCount((c) => c + 1);
  }, []);

  return { queue, isLoading, error, refetch, queueBuildMs };
}
