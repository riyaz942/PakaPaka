import { RELATED_ITEM_BOOST_DELTA } from '@/config/constants';

import type { RelatedItem } from '@/core/content/content.types';

export type BoostDelta = {
  itemId: string;
  delta: number;
};

/**
 * Computes per-related-item boost deltas for a correct answer.
 * Correct-only enforcement is the caller's responsibility.
 * Cap accumulation and persistence are enforced by `applyBoosts` in `relatedItemBoostRepository.ts`.
 */
export function computeBoosts(
  relatedItems: RelatedItem[],
  options: { delta?: number } = {},
): BoostDelta[] {
  const delta = options.delta ?? RELATED_ITEM_BOOST_DELTA;

  if (relatedItems.length === 0 || delta <= 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: BoostDelta[] = [];

  for (const related of relatedItems) {
    if (seen.has(related.id)) continue;
    seen.add(related.id);
    result.push({ itemId: related.id, delta });
  }

  return result;
}
