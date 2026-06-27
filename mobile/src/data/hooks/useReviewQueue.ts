import { useCallback, useEffect, useState } from 'react';

import { QUEUE_FETCH_LIMIT } from '@/config/constants';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import { buildReviewQueue } from '@/core/srs/queueBuilder';
import type { QueueInputItem } from '@/core/srs/queueBuilder';
import type { ReviewItem } from '@/core/srs/srs.types';
import { getItemById, getRequiredParentsForItems } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getPersonalMnemonic } from '@/data/user/mnemonicRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import {
  getDueSrsStates,
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

function getInProgressItemIds(userDb: import('expo-sqlite').SQLiteDatabase): string[] {
  const rows = userDb.getAllSync<{ item_id: number }>(
    `SELECT item_id FROM item_study_status WHERE status = 'in_progress'`,
  );
  return rows.map((row) => String(row.item_id));
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

      // AC1: Seed missing SRS states for in_progress items
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

      // Dual-query pattern: curriculum items from curriculumDb, statuses from userDb
      const parentsMap = getRequiredParentsForItems(curriculumDb, itemIds);
      const allParentIds = Array.from(parentsMap.values())
        .flat()
        .map((p) => p.id);
      const uniqueParentIds = [...new Set(allParentIds)];
      const parentStatuses = listStudyStatusesForItems(
        userDb,
        uniqueParentIds,
      );

      const studyStatusMap = listStudyStatusesForItems(userDb, itemIds);

      const queueInputs: QueueInputItem[] = [];
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

        const personalMnemonic = getPersonalMnemonic(userDb, srsState.itemId);

        queueInputs.push({
          srsState,
          curriculumItem,
          parents,
          parentStatuses,
          studyStatus,
          personalMnemonic,
        });
      }

      const built = buildReviewQueue(queueInputs, { now });
      const elapsed = Date.now() - t0;

      if (__DEV__ && elapsed > 100) {
        console.warn(`[ReviewQueue] queueBuildMs=${elapsed}ms exceeds 100ms budget`);
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
