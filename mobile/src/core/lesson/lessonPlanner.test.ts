import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';

import { planLesson, type LessonCandidate } from './lessonPlanner';

function candidate(
  id: string,
  itemType: LessonCandidate['itemType'],
  sortOrder: number,
): LessonCandidate {
  return { id, itemType, primaryForm: id, meaning: `meaning-${id}`, sortOrder };
}

function emptyInput(candidates: LessonCandidate[], size: number) {
  return {
    candidates,
    studyStatuses: new Map<string, ContentStudyStatus>(),
    startedItemIds: new Set<string>(),
    parentsByItemId: new Map<string, ContentParentItem[]>(),
    parentStatuses: new Map<string, ContentStudyStatus>(),
    size,
  };
}

describe('planLesson', () => {
  it('returns at most `size` items', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate(`k${i}`, 'kanji', i),
    );
    expect(planLesson(emptyInput(candidates, 5))).toHaveLength(5);
  });

  it('excludes known, in_progress, and already-started items', () => {
    const candidates = [
      candidate('1', 'kanji', 1),
      candidate('2', 'kanji', 2),
      candidate('3', 'kanji', 3),
      candidate('4', 'kanji', 4),
    ];
    const input = emptyInput(candidates, 10);
    input.studyStatuses.set('1', 'known');
    input.studyStatuses.set('2', 'in_progress');
    input.startedItemIds.add('3');

    const result = planLesson(input);
    expect(result.map((item) => item.id)).toEqual(['4']);
  });

  it('excludes locked items whose parents are not started', () => {
    const candidates = [candidate('10', 'kanji', 1), candidate('11', 'kanji', 2)];
    const input = emptyInput(candidates, 10);
    input.parentsByItemId.set('10', [
      { id: 'r1', primaryForm: '一', itemType: 'radical' },
    ]);
    // r1 has no status → locked

    const result = planLesson(input);
    expect(result.map((item) => item.id)).toEqual(['11']);
  });

  it('includes items whose parents are known or in progress', () => {
    const candidates = [candidate('10', 'kanji', 1)];
    const input = emptyInput(candidates, 10);
    input.parentsByItemId.set('10', [
      { id: 'r1', primaryForm: '一', itemType: 'radical' },
    ]);
    input.parentStatuses.set('r1', 'known');

    expect(planLesson(input).map((item) => item.id)).toEqual(['10']);
  });

  it('interleaves radicals first and gives every available type a floor slot', () => {
    const candidates = [
      candidate('g1', 'grammar', 1),
      candidate('v1', 'vocabulary', 1),
      candidate('v2', 'vocabulary', 2),
      candidate('k1', 'kanji', 1),
      candidate('k2', 'kanji', 2),
      candidate('r1', 'radical', 1),
      candidate('r2', 'radical', 2),
    ];

    const result = planLesson(emptyInput(candidates, 7));
    expect(result.map((item) => item.id)).toEqual([
      'r1',
      'k1',
      'v1',
      'g1',
      'r2',
      'k2',
      'v2',
    ]);
  });

  it('includes at least one grammar item in a size-5 lesson when grammar candidates exist', () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => candidate(`r${i}`, 'radical', i)),
      ...Array.from({ length: 10 }, (_, i) => candidate(`k${i}`, 'kanji', i)),
      ...Array.from({ length: 10 }, (_, i) => candidate(`v${i}`, 'vocabulary', i)),
      ...Array.from({ length: 10 }, (_, i) => candidate(`g${i}`, 'grammar', i)),
    ];

    const result = planLesson(emptyInput(candidates, 5));
    expect(result).toHaveLength(5);
    expect(result.some((item) => item.itemType === 'grammar')).toBe(true);
  });

  it('gives grammar a slot on day one when only radicals and grammar are unlocked', () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => candidate(`r${i}`, 'radical', i)),
      ...Array.from({ length: 10 }, (_, i) => candidate(`g${i}`, 'grammar', i)),
    ];

    const result = planLesson(emptyInput(candidates, 5));
    expect(result.map((item) => item.itemType)).toEqual([
      'radical',
      'grammar',
      'radical',
      'radical',
      'radical',
    ]);
  });

  it('fills the whole lesson from a single type when only that type has candidates', () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      candidate(`g${i}`, 'grammar', i),
    );

    const result = planLesson(emptyInput(candidates, 5));
    expect(result).toHaveLength(5);
    expect(result.every((item) => item.itemType === 'grammar')).toBe(true);
  });

  it('orders within a type by sortOrder', () => {
    const candidates = [
      candidate('b', 'vocabulary', 5),
      candidate('a', 'vocabulary', 1),
    ];
    const result = planLesson(emptyInput(candidates, 2));
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('puts an opted-in item at the front of its type, ahead of a lower sortOrder', () => {
    // `sort_order` restarts at 1 per level and per type, so an opted-in N3
    // kanji merged into an N5 pool has no comparable position — and a learner
    // who just asked for it should not wait out the rest of the level.
    const candidates = [
      candidate('n5-a', 'kanji', 1),
      candidate('n5-b', 'kanji', 2),
      { ...candidate('opted-in', 'kanji', 67), optedIn: true },
    ];
    const result = planLesson(emptyInput(candidates, 3));
    expect(result.map((item) => item.id)).toEqual(['opted-in', 'n5-a', 'n5-b']);
  });

  it('keeps an opted-in kanji behind its radicals, which lead every round', () => {
    const candidates = [
      { ...candidate('opted-in-kanji', 'kanji', 67), optedIn: true },
      { ...candidate('opted-in-radical', 'radical', 70), optedIn: true },
    ];
    const result = planLesson(emptyInput(candidates, 2));
    expect(result.map((item) => item.id)).toEqual(['opted-in-radical', 'opted-in-kanji']);
  });

  it('returns empty for size zero or no candidates', () => {
    expect(planLesson(emptyInput([], 5))).toEqual([]);
    expect(planLesson(emptyInput([candidate('1', 'kanji', 1)], 0))).toEqual([]);
  });
});
