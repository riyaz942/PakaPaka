import { selectAtRiskItems } from './atRiskSelector';

describe('selectAtRiskItems', () => {
  it('returns empty selection when no candidate has a positive weakness score', () => {
    const selection = selectAtRiskItems([
      { itemId: '1', weaknessScore: 0, dueDate: '2026-07-20T00:00:00.000Z' },
      { itemId: '2', weaknessScore: 0, dueDate: null },
    ]);

    expect(selection.totalCount).toBe(0);
    expect(selection.topItemIds).toEqual([]);
  });

  it('ranks by weakness score descending', () => {
    const selection = selectAtRiskItems([
      { itemId: 'mild', weaknessScore: 0.2, dueDate: null },
      { itemId: 'severe', weaknessScore: 0.8, dueDate: null },
      { itemId: 'medium', weaknessScore: 0.5, dueDate: null },
    ]);

    expect(selection.topItemIds).toEqual(['severe', 'medium', 'mild']);
    expect(selection.totalCount).toBe(3);
  });

  it('breaks weakness ties by due proximity (sooner first, unknown last)', () => {
    const selection = selectAtRiskItems([
      { itemId: 'unknown-due', weaknessScore: 0.5, dueDate: null },
      { itemId: 'later', weaknessScore: 0.5, dueDate: '2026-07-25T00:00:00.000Z' },
      { itemId: 'overdue', weaknessScore: 0.5, dueDate: '2026-07-18T00:00:00.000Z' },
    ]);

    expect(selection.topItemIds).toEqual(['overdue', 'later', 'unknown-due']);
  });

  it('caps topItemIds at topN while keeping totalCount and full ranking', () => {
    const candidates = Array.from({ length: 12 }, (_, i) => ({
      itemId: String(i + 1),
      weaknessScore: (12 - i) / 12,
      dueDate: null,
    }));

    const selection = selectAtRiskItems(candidates, 8);
    expect(selection.topItemIds).toHaveLength(8);
    expect(selection.totalCount).toBe(12);
    expect(selection.rankedItemIds).toHaveLength(12);
  });
});
