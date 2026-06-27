import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';

export function isItemUnlocked(
  parents: ContentParentItem[],
  parentStatuses: Map<string, ContentStudyStatus>,
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
  parents: ContentParentItem[],
  parentStatuses: Map<string, ContentStudyStatus>,
): ContentParentItem[] {
  return parents.filter((parent) => {
    const status = parentStatuses.get(parent.id) ?? 'not_started';
    return status === 'not_started';
  });
}
