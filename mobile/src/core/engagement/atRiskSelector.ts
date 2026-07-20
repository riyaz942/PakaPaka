import { AT_RISK_TOP_N } from '@/config/constants';

export type AtRiskCandidate = {
  itemId: string;
  /** From calculateWeaknessScore — already 0 when WEAKNESS_MIN_SAMPLE unmet. */
  weaknessScore: number;
  /** ISO due date from srs_states, or null when unknown. */
  dueDate: string | null;
};

export type AtRiskSelection = {
  totalCount: number;
  /** Ranked item IDs capped at topN — weakest first, sooner-due breaking ties. */
  topItemIds: string[];
  /** Full ranked list (uncapped) for the revision session handoff. */
  rankedItemIds: string[];
};

/**
 * FR59 at-risk ranking: only items with a proven weakness (score > 0, which
 * implies WEAKNESS_MIN_SAMPLE attempts) qualify. Weakness score is the primary
 * rank; due proximity breaks ties so overdue/soonest items surface first.
 */
export function selectAtRiskItems(
  candidates: AtRiskCandidate[],
  topN: number = AT_RISK_TOP_N,
): AtRiskSelection {
  const ranked = candidates
    .filter((candidate) => candidate.weaknessScore > 0)
    .sort((left, right) => {
      if (right.weaknessScore !== left.weaknessScore) {
        return right.weaknessScore - left.weaknessScore;
      }
      if (left.dueDate === null) return right.dueDate === null ? 0 : 1;
      if (right.dueDate === null) return -1;
      return left.dueDate.localeCompare(right.dueDate);
    })
    .map((candidate) => candidate.itemId);

  return {
    totalCount: ranked.length,
    topItemIds: ranked.slice(0, topN),
    rankedItemIds: ranked,
  };
}
