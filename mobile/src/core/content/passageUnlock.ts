import { PASSAGE_UNLOCK_COVERAGE } from '@/config/constants';
import type { SRSStageLabel } from '@/core/srs/srs.types';

export type PassageUnlockStatus = {
  unlocked: boolean;
  /** Linked vocab + grammar items total. */
  linkedCount: number;
  /** Linked items at Guru or above, or marked known (burned counts as covered). */
  guruOrAboveCount: number;
  /** Coverage ratio in [0, 1]; 0 when no links exist. */
  coverage: number;
  /** How many more linked items must reach Guru+ to cross the threshold. */
  itemsRemainingToUnlock: number;
};

/** Stages that count as "covered" for passage unlock (FR68). */
export const GURU_PLUS: ReadonlySet<SRSStageLabel> = new Set([
  'guru',
  'master',
  'enlightened',
  'burned',
]);

/** Guru or above, or marked known by the learner. */
export function isPassageItemCovered(
  itemId: string,
  stageByItemId: ReadonlyMap<string, SRSStageLabel>,
  knownItemIds: ReadonlySet<string>,
): boolean {
  if (knownItemIds.has(itemId)) return true;
  const stage = stageByItemId.get(itemId);
  return stage !== undefined && GURU_PLUS.has(stage);
}

/**
 * Shared passage unlock math (FR60/FR68, M1): a passage unlocks when
 * `guruOrAboveCount / linkedCount >= PASSAGE_UNLOCK_COVERAGE` (90%).
 * Derived only — never persisted. Story 3.2 reuses this helper.
 *
 * A passage with no links is treated as locked with linkedCount 0; callers
 * should hide readiness UI rather than show "0 items from unlocking".
 *
 * An item the learner marked `known` counts as covered whatever its stage:
 * `known` keeps it out of lessons and reviews, so it could never reach Guru.
 */
export function computePassageUnlock(
  linkedItemIds: string[],
  stageByItemId: ReadonlyMap<string, SRSStageLabel>,
  knownItemIds: ReadonlySet<string> = new Set(),
): PassageUnlockStatus {
  const linkedCount = linkedItemIds.length;
  if (linkedCount === 0) {
    return {
      unlocked: false,
      linkedCount: 0,
      guruOrAboveCount: 0,
      coverage: 0,
      itemsRemainingToUnlock: 0,
    };
  }

  let guruOrAboveCount = 0;
  for (const itemId of linkedItemIds) {
    if (isPassageItemCovered(itemId, stageByItemId, knownItemIds)) guruOrAboveCount += 1;
  }

  const coverage = guruOrAboveCount / linkedCount;
  const required = Math.ceil(linkedCount * PASSAGE_UNLOCK_COVERAGE);
  const itemsRemainingToUnlock = Math.max(0, required - guruOrAboveCount);

  return {
    unlocked: coverage >= PASSAGE_UNLOCK_COVERAGE,
    linkedCount,
    guruOrAboveCount,
    coverage,
    itemsRemainingToUnlock,
  };
}
