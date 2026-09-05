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

// Generic so the caller gets its own richer parent type back — this only
// filters, it never rebuilds the entries.
export function getUnmetPrerequisites<T extends ContentParentItem>(
  parents: T[],
  parentStatuses: Map<string, ContentStudyStatus>,
): T[] {
  return parents.filter((parent) => {
    const status = parentStatuses.get(parent.id) ?? 'not_started';
    return status === 'not_started';
  });
}
