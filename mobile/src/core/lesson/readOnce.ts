/**
 * A read-once card (the conjugation primer) is read before the first lesson
 * that needs it and never reviewed. A learner who already started something
 * after it has moved past it, so it is not offered to them.
 */
export function dropPassedReadOnce<T extends { id: string; sortOrder: number }>(
  grammar: T[],
  readOnceIds: ReadonlySet<string>,
  startedOrKnownIds: ReadonlySet<string>,
): T[] {
  return grammar.filter(
    (item) =>
      !readOnceIds.has(item.id) ||
      !grammar.some(
        (other) => other.sortOrder > item.sortOrder && startedOrKnownIds.has(other.id),
      ),
  );
}
