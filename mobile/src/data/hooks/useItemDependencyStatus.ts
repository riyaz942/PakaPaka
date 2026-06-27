import { useEffect, useState } from 'react';

import { getUnmetPrerequisites, isItemUnlocked } from '@/core/content/dependencyGraph';
import {
  getRequiredParentsForItems,
  type CurriculumParentItem,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

export type ItemDependencyStatus = {
  parents: CurriculumParentItem[];
  parentStatuses: Map<string, StudyStatus>;
  isLocked: boolean;
  unmetPrerequisites: CurriculumParentItem[];
  loading: boolean;
};

const EMPTY_STATUS: ItemDependencyStatus = {
  parents: [],
  parentStatuses: new Map(),
  isLocked: false,
  unmetPrerequisites: [],
  loading: false,
};

export function useItemDependencyStatus(itemId: string | null): ItemDependencyStatus {
  const { curriculumDb, userDb } = useDatabase();
  const [result, setResult] = useState<ItemDependencyStatus>({
    ...EMPTY_STATUS,
    loading: true,
  });

  useEffect(() => {
    if (!itemId) {
      setResult(EMPTY_STATUS);
      return;
    }

    setResult((prev) => ({ ...prev, loading: true }));

    const parentsMap = getRequiredParentsForItems(curriculumDb, [itemId]);
    const parents = parentsMap.get(itemId) ?? [];
    const parentIds = parents.map((parent) => parent.id);
    const parentStatuses =
      parentIds.length > 0
        ? listStudyStatusesForItems(userDb, parentIds)
        : new Map<string, StudyStatus>();
    const locked = !isItemUnlocked(parents, parentStatuses);
    const unmet = getUnmetPrerequisites(parents, parentStatuses);

    setResult({
      parents,
      parentStatuses,
      isLocked: locked,
      unmetPrerequisites: unmet,
      loading: false,
    });
  }, [curriculumDb, userDb, itemId]);

  return result;
}
