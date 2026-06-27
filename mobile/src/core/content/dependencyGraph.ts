import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

export function isItemUnlocked(
  parents: CurriculumParentItem[],
  parentStatuses: Map<string, StudyStatus>,
): boolean {
  if (parents.length === 0) {
    return true;
  }

  return parents.every((parent) => {
    const status = parentStatuses.get(parent.id) ?? 'not_started';
    return status === 'known' || status === 'in_progress';
  });
}

export function getUnmetPrerequisites(
  parents: CurriculumParentItem[],
  parentStatuses: Map<string, StudyStatus>,
): CurriculumParentItem[] {
  return parents.filter((parent) => {
    const status = parentStatuses.get(parent.id) ?? 'not_started';
    return status === 'not_started';
  });
}
