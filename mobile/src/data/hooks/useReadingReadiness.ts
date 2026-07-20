import { useCallback, useEffect, useState } from 'react';

import { computePassageUnlock } from '@/core/content/passageUnlock';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getAllPassageLinkedItemIds,
  listAllPassages,
} from '@/data/curriculum/passageRepository';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';

import type { SRSStageLabel } from '@/core/srs/srs.types';

export type ReadingReadinessTarget = {
  passageId: string;
  title: string;
  itemsRemainingToUnlock: number;
  /** True while the learner has no Guru+ coverage on the target at all (day 1). */
  noProgressYet: boolean;
};

type UseReadingReadinessResult = {
  /** Next destination passage, or null when readiness should be hidden. */
  target: ReadingReadinessTarget | null;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Reading readiness destination (FR60): the closest-to-unlocking locked
 * passage at the learner's JLPT level, else the first locked passage overall.
 * Hidden (null) when there are no locked passages with links — either no
 * passages exist or everything is already unlocked.
 */
export function useReadingReadiness(): UseReadingReadinessResult {
  const { curriculumDb, userDb } = useDatabase();
  const [target, setTarget] = useState<ReadingReadinessTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    try {
      const level = getStartingJlptLevel(userDb);
      const passages = listAllPassages(curriculumDb);

      // Batched link + SRS reads: one pass over each link table and a single
      // SRS query for the union of linked ids, rather than three queries per
      // passage (the N+1 deferred from 2.2). Selection semantics below are
      // unchanged.
      const linkedByPassageId = getAllPassageLinkedItemIds(curriculumDb);
      const allLinkedIds = new Set<string>();
      for (const linkedIds of linkedByPassageId.values()) {
        for (const itemId of linkedIds) allLinkedIds.add(itemId);
      }

      const stageByItemId = new Map<string, SRSStageLabel>();
      for (const [itemId, state] of getSrsStatesForItems(userDb, [...allLinkedIds])) {
        stageByItemId.set(itemId, state.srsStageLabel);
      }

      type LockedCandidate = ReadingReadinessTarget & { atUserLevel: boolean };
      const locked: LockedCandidate[] = [];

      for (const passage of passages) {
        const linkedIds = linkedByPassageId.get(passage.id) ?? [];
        if (linkedIds.length === 0) continue; // unlinked passages never gate readiness

        const status = computePassageUnlock(linkedIds, stageByItemId);
        if (status.unlocked) continue;

        locked.push({
          passageId: passage.id,
          title: passage.title,
          itemsRemainingToUnlock: status.itemsRemainingToUnlock,
          noProgressYet: status.guruOrAboveCount === 0,
          atUserLevel: level !== null && passage.jlptLevel === level,
        });
      }

      const atLevel = locked.filter((candidate) => candidate.atUserLevel);
      const pool = atLevel.length > 0 ? atLevel : locked;
      const picked =
        atLevel.length > 0
          ? pool.reduce((best, candidate) =>
              candidate.itemsRemainingToUnlock < best.itemsRemainingToUnlock
                ? candidate
                : best,
            )
          : (pool[0] ?? null);

      setTarget(
        picked
          ? {
              passageId: picked.passageId,
              title: picked.title,
              itemsRemainingToUnlock: picked.itemsRemainingToUnlock,
              noProgressYet: picked.noProgressYet,
            }
          : null,
      );
    } catch {
      setTarget(null);
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb, fetchCount]);

  const refetch = useCallback(() => {
    setFetchCount((count) => count + 1);
  }, []);

  return { target, isLoading, refetch };
}
