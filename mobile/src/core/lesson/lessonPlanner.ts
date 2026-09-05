import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';
import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export type LessonItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type LessonCandidate = {
  id: string;
  itemType: LessonItemType;
  primaryForm: string;
  meaning: string;
  sortOrder: number;
  /**
   * The learner asked for this item ahead of its level (opt-in unlock), so it
   * sorts to the front of its type bucket.
   *
   * Not a nicety: `sort_order` restarts at 1 per level *and* per type, so an
   * opted-in N3 kanji merged into an N5 pool would otherwise land wherever its
   * own level's numbering happens to put it. And a queue that quietly defers
   * what the learner just asked for is a queue they stop trusting.
   */
  optedIn?: boolean;
};

export type LessonPlanInput = {
  candidates: LessonCandidate[];
  /** Study status per item id (known / in_progress); absent means not started. */
  studyStatuses: Map<string, ContentStudyStatus>;
  /** Item ids that already have an SRS state (imported or previously started). */
  startedItemIds: Set<string>;
  /** Required parents per item id, for dependency gating. */
  parentsByItemId: Map<string, ContentParentItem[]>;
  /** Study status per parent id (superset of studyStatuses is fine). */
  parentStatuses: Map<string, ContentStudyStatus>;
  size: number;
};

export const LESSON_SIZE_BY_INTENSITY: Record<SessionIntensity, number> = {
  light: 3,
  relaxed: 5,
  steady: 7,
  intense: 10,
  immersive: 15,
};

export function lessonSizeForIntensity(intensity: SessionIntensity | null): number {
  return LESSON_SIZE_BY_INTENSITY[intensity ?? 'relaxed'];
}

/**
 * Interleave order and per-round quotas. Radicals lead each round because they
 * unlock kanji; grammar is throttled to one per round to keep lessons light.
 */
const ROUND_QUOTAS: readonly { type: LessonItemType; quota: number }[] = [
  { type: 'radical', quota: 2 },
  { type: 'kanji', quota: 2 },
  { type: 'vocabulary', quota: 2 },
  { type: 'grammar', quota: 1 },
];

/**
 * Picks today's lesson: unlocked, not-yet-started items in curriculum order
 * (opted-in items first), interleaved across types so a lesson is never a wall
 * of one item type.
 *
 * Every type with available candidates is guaranteed at least one slot when
 * size allows, so grammar (which has no unlock prerequisites) is never starved
 * by a deep radical bucket and radicals never monopolise a first-day lesson.
 */
export function planLesson(input: LessonPlanInput): LessonCandidate[] {
  const { candidates, studyStatuses, startedItemIds, parentsByItemId, parentStatuses, size } =
    input;

  if (size <= 0) {
    return [];
  }

  const buckets = new Map<LessonItemType, LessonCandidate[]>();
  for (const { type } of ROUND_QUOTAS) {
    buckets.set(type, []);
  }

  for (const candidate of candidates) {
    const status = studyStatuses.get(candidate.id);
    if (status === 'known' || status === 'in_progress') continue;
    if (startedItemIds.has(candidate.id)) continue;

    const parents = parentsByItemId.get(candidate.id) ?? [];
    if (!isItemUnlocked(parents, parentStatuses)) continue;

    buckets.get(candidate.itemType)?.push(candidate);
  }

  for (const bucket of buckets.values()) {
    bucket.sort(
      (a, b) =>
        Number(b.optedIn ?? false) - Number(a.optedIn ?? false) || a.sortOrder - b.sortOrder,
    );
  }

  const result: LessonCandidate[] = [];
  const indices = new Map<LessonItemType, number>(
    ROUND_QUOTAS.map(({ type }) => [type, 0] as const),
  );

  // Floor pass: one slot per type that has candidates, so no type is starved.
  for (const { type } of ROUND_QUOTAS) {
    if (result.length >= size) break;
    const bucket = buckets.get(type)!;
    if (bucket.length > 0) {
      result.push(bucket[0]);
      indices.set(type, 1);
    }
  }

  // Weighted round-robin for the remainder. The first round's quotas count
  // the floor slot, so per-round proportions stay at ROUND_QUOTAS.
  let firstRound = true;
  let progressed = true;
  while (progressed && result.length < size) {
    progressed = false;
    for (const { type, quota } of ROUND_QUOTAS) {
      const bucket = buckets.get(type)!;
      const start = indices.get(type)!;
      const roundBase = firstRound ? 0 : start;
      const end = Math.min(roundBase + quota, bucket.length);
      for (let i = start; i < end && result.length < size; i++) {
        result.push(bucket[i]);
        indices.set(type, i + 1);
        progressed = true;
      }
      if (result.length >= size) break;
    }
    // Floor slots can absorb all of round one's quotas; only a full round
    // with untouched quotas means the buckets are exhausted.
    if (firstRound) progressed = true;
    firstRound = false;
  }

  return result;
}
