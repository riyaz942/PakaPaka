import type { ContentItemSummary } from '@/core/content/content.types';

import { buildReviewQueue, INTERLEAVE_WEIGHTS, type QueueInputItem } from './queueBuilder';
import type { SRSState } from './srs.types';

const NOW = new Date('2026-06-27T10:00:00.000Z');
const PAST = new Date('2026-06-26T10:00:00.000Z');
const FUTURE = new Date('2026-06-28T10:00:00.000Z');

function makeSrsState(itemId: string, dueDate: Date, overrides: Partial<SRSState> = {}): SRSState {
  return {
    itemId,
    stability: 5,
    difficulty: 5,
    dueDate: dueDate.toISOString(),
    fsrsState: 'review',
    reps: 3,
    lapses: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    updatedAt: PAST.toISOString(),
    ...overrides,
  };
}

function makeCurriculumItem(
  id: string,
  itemType: ContentItemSummary['itemType'],
): ContentItemSummary {
  return {
    id,
    itemType,
    primaryForm: `form-${id}`,
    meaning: `meaning-${id}`,
    mnemonicText: null,
  };
}

function makeQueueItem(
  id: string,
  itemType: ContentItemSummary['itemType'],
  dueDate: Date = PAST,
  overrides: Partial<QueueInputItem> = {},
): QueueInputItem {
  return {
    srsState: makeSrsState(id, dueDate),
    curriculumItem: makeCurriculumItem(id, itemType),
    parents: [],
    parentStatuses: new Map(),
    studyStatus: 'in_progress',
    answerKey: {
      acceptedMeanings: [`meaning-${id}`],
      acceptedReadings: ['いち'],
    },
    ...overrides,
  };
}

describe('buildReviewQueue', () => {
  it('returns empty queue when no items are due', () => {
    const items = [makeQueueItem('1', 'kanji', FUTURE)];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('excludes burned items', () => {
    const items = [
      makeQueueItem('1', 'kanji', PAST, {
        srsState: makeSrsState('1', PAST, { isBurned: true }),
      }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('excludes items with known study status', () => {
    const items = [makeQueueItem('1', 'kanji', PAST, { studyStatus: 'known' })];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('excludes locked items (parent not in_progress/known)', () => {
    const items = [
      makeQueueItem('1', 'kanji', PAST, {
        parents: [{ id: '99', primaryForm: 'radical', itemType: 'radical' }],
        parentStatuses: new Map([['99', 'not_started']]),
      }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(0);
  });

  it('includes unlocked items (parent is in_progress)', () => {
    const items = [
      makeQueueItem('1', 'kanji', PAST, {
        parents: [{ id: '99', primaryForm: 'radical', itemType: 'radical' }],
        parentStatuses: new Map([['99', 'in_progress']]),
      }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(1);
  });

  it('maps item fields to ReviewItem correctly', () => {
    const items = [makeQueueItem('42', 'vocabulary', PAST)];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result[0].itemId).toBe('42');
    expect(result[0].itemType).toBe('vocabulary');
    expect(result[0].primaryForm).toBe('form-42');
    expect(result[0].meanings).toEqual(['meaning-42']);
    expect(result[0].answerKey.acceptedMeanings).toEqual(['meaning-42']);
  });

  it('interleaves content types with documented INTERLEAVE_WEIGHTS', () => {
    // 4 kanji, 4 vocabulary, 2 grammar, 2 radical, all due
    const items: QueueInputItem[] = [
      makeQueueItem('k1', 'kanji', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('k2', 'kanji', new Date('2026-06-26T02:00:00Z')),
      makeQueueItem('k3', 'kanji', new Date('2026-06-26T03:00:00Z')),
      makeQueueItem('k4', 'kanji', new Date('2026-06-26T04:00:00Z')),
      makeQueueItem('v1', 'vocabulary', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('v2', 'vocabulary', new Date('2026-06-26T02:00:00Z')),
      makeQueueItem('v3', 'vocabulary', new Date('2026-06-26T03:00:00Z')),
      makeQueueItem('v4', 'vocabulary', new Date('2026-06-26T04:00:00Z')),
      makeQueueItem('g1', 'grammar', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('g2', 'grammar', new Date('2026-06-26T02:00:00Z')),
      makeQueueItem('r1', 'radical', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('r2', 'radical', new Date('2026-06-26T02:00:00Z')),
    ];

    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(12);

    // First round: kanji:2, vocabulary:2, grammar:1, radical:1
    expect(result[0].itemId).toBe('k1');
    expect(result[1].itemId).toBe('k2');
    expect(result[2].itemId).toBe('v1');
    expect(result[3].itemId).toBe('v2');
    expect(result[4].itemId).toBe('g1');
    expect(result[5].itemId).toBe('r1');

    // Second round
    expect(result[6].itemId).toBe('k3');
    expect(result[7].itemId).toBe('k4');
    expect(result[8].itemId).toBe('v3');
    expect(result[9].itemId).toBe('v4');
    expect(result[10].itemId).toBe('g2');
    expect(result[11].itemId).toBe('r2');
  });

  it('handles missing type bucket gracefully (no kanji due)', () => {
    const items = [
      makeQueueItem('v1', 'vocabulary', PAST),
      makeQueueItem('g1', 'grammar', PAST),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(2);
    // vocabulary weight=2, grammar weight=1 → v1, g1 (single items each)
    const types = result.map((i) => i.itemType);
    expect(types).toContain('vocabulary');
    expect(types).toContain('grammar');
  });

  it('respects limit option', () => {
    const items = [
      makeQueueItem('k1', 'kanji', PAST),
      makeQueueItem('k2', 'kanji', PAST),
      makeQueueItem('v1', 'vocabulary', PAST),
    ];
    const result = buildReviewQueue(items, { now: NOW, limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('exports INTERLEAVE_WEIGHTS with expected defaults', () => {
    expect(INTERLEAVE_WEIGHTS['kanji']).toBe(2);
    expect(INTERLEAVE_WEIGHTS['vocabulary']).toBe(2);
    expect(INTERLEAVE_WEIGHTS['grammar']).toBe(1);
    expect(INTERLEAVE_WEIGHTS['radical']).toBe(1);
  });

  it('sorts boosted due items ahead of equal-due unboosted items', () => {
    const sameDue = new Date('2026-06-26T10:00:00Z');
    const items = [
      makeQueueItem('1', 'kanji', sameDue, { boost: 0 }),
      makeQueueItem('2', 'kanji', sameDue, { boost: 0.5 }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result.map((i) => i.itemId)).toEqual(['2', '1']);
  });

  it('does not pull not-due items into the queue via boost', () => {
    const items = [
      makeQueueItem('1', 'kanji', FUTURE, { boost: 10 }),
      makeQueueItem('2', 'kanji', PAST, { boost: 0 }),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('2');
  });

  it('preserves existing ordering when boost is omitted (default 0)', () => {
    const items = [
      makeQueueItem('1', 'vocabulary', new Date('2026-06-26T01:00:00Z')),
      makeQueueItem('2', 'vocabulary', new Date('2026-06-26T02:00:00Z')),
    ];
    const result = buildReviewQueue(items, { now: NOW });
    expect(result.map((i) => i.itemId)).toEqual(['1', '2']);
  });
});
