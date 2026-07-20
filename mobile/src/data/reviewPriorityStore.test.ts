import {
  applyReviewPriority,
  clearReviewPriority,
  getReviewPriority,
  setReviewPriority,
} from './reviewPriorityStore';

function due(...itemIds: string[]) {
  return itemIds.map((itemId) => ({ itemId }));
}

describe('reviewPriorityStore', () => {
  afterEach(() => {
    clearReviewPriority();
  });

  it('is consumed once: set → get → clear → get null', () => {
    setReviewPriority({ itemIds: ['1', '2'], limit: null });
    expect(getReviewPriority()).toEqual({ itemIds: ['1', '2'], limit: null });

    clearReviewPriority();
    expect(getReviewPriority()).toBeNull();
  });
});

describe('applyReviewPriority', () => {
  it('returns the due set unchanged when no priority is stored', () => {
    const states = due('1', '2');
    expect(applyReviewPriority(states, null)).toBe(states);
  });

  it('narrows to preferred IDs that are actually due (at-risk revision)', () => {
    const result = applyReviewPriority(due('1', '2', '3'), {
      itemIds: ['3', '1', '99'],
      limit: null,
    });
    expect(result.map((s) => s.itemId)).toEqual(['1', '3']);
  });

  it('falls back to the full due set when no preferred ID is due', () => {
    const result = applyReviewPriority(due('1', '2'), { itemIds: ['99'], limit: null });
    expect(result.map((s) => s.itemId)).toEqual(['1', '2']);
  });

  it('caps the session with limit (welcome-back slice)', () => {
    const states = due(...Array.from({ length: 50 }, (_, i) => String(i + 1)));
    const result = applyReviewPriority(states, { itemIds: [], limit: 20 });
    expect(result).toHaveLength(20);
    expect(result[0].itemId).toBe('1');
  });
});
