import { isPassageItemCovered } from '@/core/content/passageUnlock';

import type { SRSStageLabel } from '@/core/srs/srs.types';

/**
 * The linked vocab/grammar a locked passage is still waiting on (FR69): every
 * linked item whose SRS stage is missing or below Guru and that the learner has
 * not marked known, in link order.
 *
 * Pure sibling of `computePassageUnlock` — this decides *what* to show on the
 * locked passage to-do list, never *whether* the passage is unlocked. The 90%
 * threshold lives in `computePassageUnlock` and is not re-derived here, so a
 * passage can be unlocked (>= 90% covered) while this list is still non-empty.
 */
export function listNeededItemsForPassage(
  linkedItemIds: string[],
  stageByItemId: ReadonlyMap<string, SRSStageLabel>,
  knownItemIds: ReadonlySet<string> = new Set(),
): string[] {
  const needed: string[] = [];
  const seen = new Set<string>();

  for (const itemId of linkedItemIds) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);

    if (!isPassageItemCovered(itemId, stageByItemId, knownItemIds)) {
      needed.push(itemId);
    }
  }

  return needed;
}
