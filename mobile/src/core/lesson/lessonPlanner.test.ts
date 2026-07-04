import type { ContentParentItem, ContentStudyStatus } from '@/core/content/content.types';

import {
  LESSON_SIZE_BY_INTENSITY,
  lessonSizeForIntensity,
  planLesson,
  type LessonCandidate,
} from './lessonPlanner';

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

describe('lessonSizeForIntensity', () => {
  it('defaults to relaxed when intensity is unset', () => {
    expect(lessonSizeForIntensity(null)).toBe(LESSON_SIZE_BY_INTENSITY.relaxed);
  });

  it('returns the intense size', () => {
    expect(lessonSizeForIntensity('intense')).toBe(LESSON_SIZE_BY_INTENSITY.intense);
  });
});

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

  it('interleaves radicals ahead of kanji and mixes types', () => {
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
      'r2',
      'k1',
      'k2',
      'v1',
      'v2',
      'g1',
    ]);
  });

  it('orders within a type by sortOrder', () => {
    const candidates = [
      candidate('b', 'vocabulary', 5),
      candidate('a', 'vocabulary', 1),
    ];
    const result = planLesson(emptyInput(candidates, 2));
    expect(result.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('returns empty for size zero or no candidates', () => {
    expect(planLesson(emptyInput([], 5))).toEqual([]);
    expect(planLesson(emptyInput([candidate('1', 'kanji', 1)], 0))).toEqual([]);
  });
});
