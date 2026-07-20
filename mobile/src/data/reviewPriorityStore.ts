/**
 * One-shot memory handoff from Home triage CTAs to the review queue builder
 * (pattern: importPreviewStore). Never persisted — backing out of a session
 * simply drops the priority hint.
 */
export type ReviewPriority = {
  /** Item IDs to prefer; empty = no preference (welcome-back uses limit only). */
  itemIds: string[];
  /** Cap on session size (welcome-back / at-risk slice); null = no cap. */
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
 * Applies a priority hint to the candidate set.
 *
 * When `itemIds` is non-empty: keep only those IDs (in Home ranking order),
 * merging `dueStates` with `preferredStates` so not-yet-due preferred items
 * can still enter a refresher. Never falls back to the full due backlog.
 *
 * When `itemIds` is empty: start from `dueStates` (welcome-back slice path).
 * Then apply `limit` if set.
 */
export function applyReviewPriority<T extends { itemId: string }>(
  dueStates: T[],
  priority: ReviewPriority | null,
  preferredStates: T[] = [],
): T[] {
  if (!priority) return dueStates;

  let result = dueStates;
  if (priority.itemIds.length > 0) {
    const byId = new Map<string, T>();
    for (const state of dueStates) {
      byId.set(state.itemId, state);
    }
    for (const state of preferredStates) {
      byId.set(state.itemId, state);
    }
    result = priority.itemIds
      .map((id) => byId.get(id))
      .filter((state): state is T => state != null);
  }
  if (priority.limit !== null) {
    result = result.slice(0, priority.limit);
  }
  return result;
}
