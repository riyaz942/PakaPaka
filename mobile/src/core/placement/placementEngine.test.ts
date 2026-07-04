import {
  computeKnownRatio,
  resolvePlacementKnownIds,
  samplePlacementItems,
  type PlacementItemType,
  type PlacementSampleItem,
} from './placementEngine';

function items(
  type: PlacementItemType,
  count: number,
  prefix: string,
): PlacementSampleItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    itemType: type,
    primaryForm: `${prefix}${i + 1}`,
    meaning: `meaning-${prefix}${i + 1}`,
    sortOrder: i + 1,
  }));
}

describe('samplePlacementItems', () => {
  it('returns an empty sample when there are no items', () => {
    expect(samplePlacementItems(new Map())).toEqual([]);
  });

  it('spreads the sample evenly across each type in curriculum order', () => {
    const byType = new Map<PlacementItemType, PlacementSampleItem[]>([
      ['kanji', items('kanji', 100, 'k')],
      ['vocabulary', items('vocabulary', 100, 'v')],
    ]);

    const sample = samplePlacementItems(byType, 12);
    expect(sample).toHaveLength(12);

    const kanjiOrders = sample
      .filter((item) => item.itemType === 'kanji')
      .map((item) => item.sortOrder);
    expect(kanjiOrders).toHaveLength(6);
    // Evenly spaced strata midpoints: spans early and late items.
    expect(Math.min(...kanjiOrders)).toBeLessThanOrEqual(15);
    expect(Math.max(...kanjiOrders)).toBeGreaterThanOrEqual(85);
  });

  it('never samples more items than a type contains', () => {
    const byType = new Map<PlacementItemType, PlacementSampleItem[]>([
      ['grammar', items('grammar', 2, 'g')],
    ]);
    const sample = samplePlacementItems(byType, 12);
    expect(sample.length).toBeLessThanOrEqual(2);
  });
});

describe('computeKnownRatio', () => {
  it('returns 0 for no answers', () => {
    expect(computeKnownRatio([])).toBe(0);
  });

  it('returns the fraction of known answers', () => {
    expect(
      computeKnownRatio([
        { itemId: '1', known: true },
        { itemId: '2', known: true },
        { itemId: '3', known: false },
        { itemId: '4', known: false },
      ]),
    ).toBe(0.5);
  });
});

describe('resolvePlacementKnownIds', () => {
  const byType = new Map<PlacementItemType, PlacementSampleItem[]>([
    ['kanji', items('kanji', 10, 'k')],
  ]);

  it('marks the leading fraction of each type as known', () => {
    const answers = [
      { itemId: 'k1', known: true },
      { itemId: 'k9', known: false },
    ];
    // ratio 0.5 → first 5 kanji known, minus explicit unknowns
    const known = new Set(resolvePlacementKnownIds(byType, answers));
    expect(known.has('k1')).toBe(true);
    expect(known.has('k5')).toBe(true);
    expect(known.has('k6')).toBe(false);
    expect(known.has('k9')).toBe(false);
  });

  it('never includes items the user said they do not know', () => {
    const answers = [
      { itemId: 'k2', known: false },
      { itemId: 'k1', known: true },
    ];
    const known = new Set(resolvePlacementKnownIds(byType, answers));
    expect(known.has('k2')).toBe(false);
  });

  it('always includes items the user said they know, even past the cut', () => {
    const answers = [
      { itemId: 'k10', known: true },
      { itemId: 'k1', known: false },
      { itemId: 'k2', known: false },
      { itemId: 'k3', known: false },
    ];
    const known = new Set(resolvePlacementKnownIds(byType, answers));
    expect(known.has('k10')).toBe(true);
  });

  it('marks nothing when every answer is unknown', () => {
    const answers = [
      { itemId: 'k1', known: false },
      { itemId: 'k5', known: false },
    ];
    expect(resolvePlacementKnownIds(byType, answers)).toEqual([]);
  });
});
