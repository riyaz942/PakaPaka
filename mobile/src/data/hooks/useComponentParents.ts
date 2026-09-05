import { useMemo } from 'react';

import {
  getComponentParentsForItem,
  type CurriculumParentItem,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

export type ComponentParent = CurriculumParentItem & {
  /**
   * The chip is a character this learner has not met and is not due to meet
   * yet: out of band (`inBand: false`) *and* with no study status of its own.
   *
   * Both halves are needed. Band alone would keep 昨 marked long after an N3
   * learner had actually learned it; study status alone would mark 日 on a
   * freshly opened 昨日, where the chip is a prerequisite this level teaches and
   * the study-status banner is already saying so.
   */
  notYetLearned: boolean;
};

/** Type-appropriate component parents for FR72 cross-ref chips. */
export function useComponentParents(
  itemId: string | null,
  itemType: ItemType | null,
): ComponentParent[] {
  const { curriculumDb, userDb } = useDatabase();

  return useMemo(() => {
    if (!itemId || !itemType) {
      return [];
    }
    const parents = getComponentParentsForItem(curriculumDb, itemId, itemType);
    const outOfBandIds = parents.filter((parent) => !parent.inBand).map((parent) => parent.id);
    const statuses =
      outOfBandIds.length > 0
        ? listStudyStatusesForItems(userDb, outOfBandIds)
        : new Map<string, StudyStatus>();

    return parents.map((parent) => ({
      ...parent,
      notYetLearned:
        !parent.inBand && (statuses.get(parent.id) ?? 'not_started') === 'not_started',
    }));
  }, [curriculumDb, userDb, itemId, itemType]);
}
