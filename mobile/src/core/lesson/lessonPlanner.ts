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
  relaxed: 5,
  intense: 10,
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
 * Picks today's lesson: unlocked, not-yet-started items in curriculum order,
 * interleaved across types so a lesson is never a wall of one item type.
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
    bucket.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const result: LessonCandidate[] = [];
  const indices = new Map<LessonItemType, number>(
    ROUND_QUOTAS.map(({ type }) => [type, 0] as const),
  );

  let progressed = true;
  while (progressed && result.length < size) {
    progressed = false;
    for (const { type, quota } of ROUND_QUOTAS) {
      const bucket = buckets.get(type)!;
      const start = indices.get(type)!;
      const end = Math.min(start + quota, bucket.length);
      for (let i = start; i < end && result.length < size; i++) {
        result.push(bucket[i]);
        indices.set(type, i + 1);
        progressed = true;
      }
      if (result.length >= size) break;
    }
  }

  return result;
}
