import { useCallback, useMemo, useState } from 'react';

import { JLPT_LEVELS } from '@/data/curriculum/curriculum.types';
import { getOptInPoolForItems } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import {
  addLessonOptIn,
  listLessonOptInIds,
  removeLessonOptIn,
} from '@/data/user/lessonOptInRepository';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';

export type LessonOptInOffer = {
  itemId: string;
  /**
   * Items the opt-in adds to the lesson pool: the item itself plus the
   * components above the learner's level that it cannot be taught without —
   * 昨 costs 昨 and its N4 radical 乍, but not 日, which N5 already teaches.
   */
  extraItemCount: number;
  isOptedIn: boolean;
};

/**
 * The opt-in unlock behind the not-yet-learned component chips: what taking one
 * would cost, and whether it has been taken.
 *
 * An offer is omitted when it would add nothing — every component is already in
 * band or already studied — so the affordance never appears where it has no
 * work to do. An opt-in already taken is always reported, so it stays undoable.
 */
export function useLessonOptIn(itemIds: string[]): {
  offers: Map<string, LessonOptInOffer>;
  toggle: (itemId: string) => void;
} {
  const { curriculumDb, userDb } = useDatabase();
  const [optedInIds, setOptedInIds] = useState(() => new Set(listLessonOptInIds(userDb)));
  const key = itemIds.join(',');

  const costs = useMemo(() => {
    const result = new Map<string, number>();
    const ids = key === '' ? [] : key.split(',');
    if (ids.length === 0) {
      return result;
    }

    const learnerLevelIndex = JLPT_LEVELS.indexOf(getStartingJlptLevel(userDb) ?? 'N5');

    for (const itemId of ids) {
      const aheadOfLearner = getOptInPoolForItems(curriculumDb, [itemId]).filter(
        (item) => JLPT_LEVELS.indexOf(item.jlptLevel) > learnerLevelIndex,
      );
      const aheadIds = aheadOfLearner.map((item) => item.id);
      // "Already started" has the same two-part definition the lesson planner
      // uses, so the count matches what the pool will actually offer: a study
      // status of its own, or an SRS state from a progress import.
      const statuses = listStudyStatusesForItems(userDb, aheadIds);
      const startedIds = new Set(getSrsStatesForItems(userDb, aheadIds).keys());

      result.set(
        itemId,
        aheadOfLearner.filter((item) => {
          const status = statuses.get(item.id);
          return status !== 'known' && status !== 'in_progress' && !startedIds.has(item.id);
        }).length,
      );
    }

    return result;
  }, [curriculumDb, userDb, key]);

  const offers = useMemo(() => {
    const result = new Map<string, LessonOptInOffer>();
    for (const [itemId, extraItemCount] of costs) {
      const isOptedIn = optedInIds.has(itemId);
      if (extraItemCount > 0 || isOptedIn) {
        result.set(itemId, { itemId, extraItemCount, isOptedIn });
      }
    }
    return result;
  }, [costs, optedInIds]);

  const toggle = useCallback(
    (itemId: string) => {
      const next = new Set(optedInIds);
      if (next.has(itemId)) {
        removeLessonOptIn(userDb, itemId);
        next.delete(itemId);
      } else {
        addLessonOptIn(userDb, itemId);
        next.add(itemId);
      }
      setOptedInIds(next);
    },
    [optedInIds, userDb],
  );

  return { offers, toggle };
}
