/**
 * One-shot memory handoff from Home triage CTAs to the review queue builder
 * (pattern: importPreviewStore). Never persisted — backing out of a session
 * simply drops the priority hint.
 */
export type ReviewPriority = {
  /** Item IDs to prefer among due items; empty = no preference. */
  itemIds: string[];
  /** Cap on session size (welcome-back slice); null = no cap. */
  limit: number | null;
};

let storedPriority: ReviewPriority | null = null;

export function setReviewPriority(priority: ReviewPriority): void {
  storedPriority = priority;
}

export function getReviewPriority(): ReviewPriority | null {
  return storedPriority;
}

export function clearReviewPriority(): void {
  storedPriority = null;
}

/**
 * Applies a priority hint to the due set: narrow to the preferred IDs when any
 * of them are actually due (falling back to the full set otherwise), then cap
 * to `limit`. Pure — the queue builder still owns ordering.
 */
export function applyReviewPriority<T extends { itemId: string }>(
  dueStates: T[],
  priority: ReviewPriority | null,
): T[] {
  if (!priority) return dueStates;

  let result = dueStates;
  if (priority.itemIds.length > 0) {
    const preferredIds = new Set(priority.itemIds);
    const preferred = result.filter((state) => preferredIds.has(state.itemId));
    if (preferred.length > 0) result = preferred;
  }
  if (priority.limit !== null) {
    result = result.slice(0, priority.limit);
  }
  return result;
}
