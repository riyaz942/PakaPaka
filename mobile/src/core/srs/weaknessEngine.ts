/**
 * Pure weakness engine — zero React/RN imports, zero expo-sqlite imports.
 * All DB I/O lives in data/user/weaknessRepository.ts.
 *
 * Scoring formula:
 *   errorRate = incorrectCount / (correctCount + incorrectCount)
 *   weaknessScore = errorRate  (when sampleSize >= WEAKNESS_MIN_SAMPLE, else 0)
 *
 * Typos are tracked separately and do NOT count as misses in the score.
 * A typo followed by a correct retry records one typo + one correct.
 *
 * Recency weighting: not applied in v1 — lastErrorAt is available for future use.
 */

import {
  CLUSTER_ACCURACY_THRESHOLD,
  CLUSTER_MIN_SAMPLE,
  WEAKNESS_MIN_SAMPLE,
} from '@/config/constants';
import type { ConfusionCluster, PatternDefinition, WeaknessStats } from '@/core/srs/srs.types';

/**
 * Compute a normalized weakness score in [0, 1] for a single item.
 *
 * Returns 0 if the total answered sample (correct + incorrect) is below
 * WEAKNESS_MIN_SAMPLE to avoid false positives on new items.
 *
 * Typo count is intentionally excluded from the score — typos reflect
 * input difficulty, not conceptual confusion.
 */
export function calculateWeaknessScore(stats: WeaknessStats): number {
  const total = stats.correctCount + stats.incorrectCount;
  if (total < WEAKNESS_MIN_SAMPLE) return 0;
  return stats.incorrectCount / total;
}

/**
 * Detect confusion clusters from a collection of per-item weakness stats.
 *
 * Algorithm:
 * 1. For each PatternDefinition, collect items whose itemId or patternTags
 *    overlap with the pattern's itemSlugsOrTags.
 * 2. Compute cluster-wide accuracy = sum(correct) / (sum(correct) + sum(incorrect)).
 * 3. Emit a ConfusionCluster only when:
 *    - sampleSize (total attempts in cluster) >= CLUSTER_MIN_SAMPLE
 *    - accuracy <= CLUSTER_ACCURACY_THRESHOLD
 *
 * The `now` parameter is reserved for future recency-weighted aggregation.
 */
export function detectConfusionClusters(
  statsByItem: WeaknessStats[],
  patternDefs: PatternDefinition[],
  _now: Date,
): ConfusionCluster[] {
  const clusters: ConfusionCluster[] = [];

  for (const pattern of patternDefs) {
    const tagSet = new Set(pattern.itemSlugsOrTags);

    // Match items whose itemId is in the pattern OR whose patternTags overlap.
    const matched = statsByItem.filter(
      (s) =>
        tagSet.has(s.itemId) || s.patternTags.some((t) => tagSet.has(t)),
    );

    if (matched.length === 0) continue;

    let totalCorrect = 0;
    let totalIncorrect = 0;
    for (const s of matched) {
      totalCorrect += s.correctCount;
      totalIncorrect += s.incorrectCount;
    }

    const sampleSize = totalCorrect + totalIncorrect;
    if (sampleSize < CLUSTER_MIN_SAMPLE) continue;

    const accuracy = totalCorrect / sampleSize;
    if (accuracy > CLUSTER_ACCURACY_THRESHOLD) continue;

    clusters.push({
      id: pattern.id,
      label: pattern.label,
      copy: `You often confuse ${pattern.label}`,
      accuracy,
      sampleSize,
      itemIds: matched.map((s) => s.itemId),
    });
  }

  return clusters;
}

/**
 * Compute the priority score for a single item given its FSRS urgency and weakness.
 *
 *   priority = WEAKNESS_WEIGHT × fsrsUrgency + WEAKNESS_BIAS_WEIGHT × weaknessScore
 *
 * This is kept pure and exported so queueBuilder can call it inline.
 */
export function computePriority(
  fsrsUrgency: number,
  weaknessScore: number,
  weaknessWeight: number,
  fsrsWeight: number,
): number {
  return fsrsWeight * fsrsUrgency + weaknessWeight * weaknessScore;
}

/**
 * Normalize overdue-ness to [0, 1] for use as fsrsUrgency.
 *
 * Derivation: a due item that is `overdueMs` milliseconds past its due date
 * is mapped to [0, 1] by clamping overdueMs / URGENCY_WINDOW_MS.
 * An item due exactly now → 0. An item overdue by >= URGENCY_WINDOW_MS → 1.
 *
 * URGENCY_WINDOW_MS = 7 days. Items overdue by more than 7 days get urgency = 1.
 * This preserves byte-identical ordering to `due_date ASC` when bias is off
 * because items with the same due date get the same urgency.
 */
const URGENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function normalizeFsrsUrgency(dueDateIso: string, now: Date): number {
  const overdueMs = now.getTime() - new Date(dueDateIso).getTime();
  if (overdueMs <= 0) return 0;
  return Math.min(overdueMs / URGENCY_WINDOW_MS, 1);
}
