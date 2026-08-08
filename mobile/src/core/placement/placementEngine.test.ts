import type { JLPTLevel } from '@/data/curriculum/curriculum.types';

import {
  computeKnownRatios,
  resolvePlacementOutcomes,
  samplePlacementItems,
  type PlacementItemType,
  type PlacementSampleItem,
} from './placementEngine';

function items(
  type: PlacementItemType,
  count: number,
  prefix: string,
  level: JLPTLevel = 'N5',
): PlacementSampleItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    itemType: type,
    level,
    primaryForm: `${prefix}${i + 1}`,
    meaning: `meaning-${prefix}${i + 1}`,
    sortOrder: i + 1,
  }));
}

function answer(item: PlacementSampleItem, known: boolean) {
  return { itemId: item.id, itemType: item.itemType, level: item.level, known };
}

describe('samplePlacementItems', () => {
  it('returns an empty sample when there are no items', () => {
    expect(samplePlacementItems(new Map())).toEqual([]);
  });

  it('spreads the sample evenly across each type in curriculum order', () => {
    const byLevel = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', [...items('kanji', 100, 'k'), ...items('vocabulary', 100, 'v')]],
    ]);

    const sample = samplePlacementItems(byLevel, 12);
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
    const byLevel = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', items('grammar', 2, 'g')],
    ]);
    const sample = samplePlacementItems(byLevel, 12);
    expect(sample.length).toBeLessThanOrEqual(2);
  });

  it('gives every level in the range its own full budget', () => {
    const byLevel = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', [...items('kanji', 50, 'k5', 'N5'), ...items('vocabulary', 50, 'v5', 'N5')]],
      ['N4', [...items('kanji', 50, 'k4', 'N4'), ...items('vocabulary', 50, 'v4', 'N4')]],
    ]);

    const sample = samplePlacementItems(byLevel, 12);
    // A wider range means a longer quiz, not a coarser one.
    expect(sample).toHaveLength(24);

    const byLevelCount = new Map<JLPTLevel, number>();
    for (const item of sample) {
      byLevelCount.set(item.level, (byLevelCount.get(item.level) ?? 0) + 1);
    }
    expect(byLevelCount.get('N5')).toBe(12);
    expect(byLevelCount.get('N4')).toBe(12);

    const n4Kanji = sample.filter(
      (item) => item.level === 'N4' && item.itemType === 'kanji',
    );
    expect(n4Kanji).toHaveLength(6);
  });

  it('keeps every item type sampled in every level however wide the range', () => {
    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[];
    const byLevel = new Map<JLPTLevel, PlacementSampleItem[]>(
      levels.map((level) => [
        level,
        [
          ...items('radical', 20, `r${level}`, level),
          ...items('kanji', 20, `k${level}`, level),
          ...items('vocabulary', 20, `v${level}`, level),
          ...items('grammar', 20, `g${level}`, level),
        ],
      ]),
    );

    const sample = samplePlacementItems(byLevel, 12);
    expect(sample).toHaveLength(60);

    // Every (level, type) cell gets cards — an unsampled cell would be scored as
    // entirely unknown no matter what the learner answered.
    for (const level of levels) {
      for (const itemType of ['radical', 'kanji', 'vocabulary', 'grammar'] as const) {
        const cell = sample.filter(
          (item) => item.level === level && item.itemType === itemType,
        );
        expect(cell).toHaveLength(3);
      }
    }
  });
});

describe('computeKnownRatios', () => {
  it('returns no ratios for no answers', () => {
    expect(computeKnownRatios([]).size).toBe(0);
  });

  it('keys the ratio by level and item type instead of blending them', () => {
    const kanji = items('kanji', 2, 'k', 'N5');
    const vocabulary = items('vocabulary', 2, 'v', 'N5');
    const n4Kanji = items('kanji', 2, 'k4', 'N4');

    const ratios = computeKnownRatios([
      answer(kanji[0], true),
      answer(kanji[1], true),
      answer(vocabulary[0], false),
      answer(vocabulary[1], false),
      answer(n4Kanji[0], true),
      answer(n4Kanji[1], false),
    ]);

    expect(ratios.get('N5:kanji')).toBe(1);
    expect(ratios.get('N5:vocabulary')).toBe(0);
    expect(ratios.get('N4:kanji')).toBe(0.5);
    expect(ratios.get('N4:vocabulary')).toBeUndefined();
  });
});

describe('resolvePlacementOutcomes', () => {
  const kanji = items('kanji', 10, 'k', 'N5');
  const byLevel = new Map<JLPTLevel, PlacementSampleItem[]>([['N5', kanji]]);

  it('marks the leading fraction of a type as known', () => {
    const answers = [answer(kanji[0], true), answer(kanji[8], false)];
    // ratio 0.5 → first 5 kanji known, minus explicit unknowns
    const [outcome] = resolvePlacementOutcomes(byLevel, answers);
    const known = new Set(outcome.knownIds);
    expect(known.has('k1')).toBe(true);
    expect(known.has('k5')).toBe(true);
    expect(known.has('k6')).toBe(false);
    expect(known.has('k9')).toBe(false);
  });

  it('never includes items the user said they do not know', () => {
    const answers = [answer(kanji[1], false), answer(kanji[0], true)];
    const [outcome] = resolvePlacementOutcomes(byLevel, answers);
    expect(outcome.knownIds).not.toContain('k2');
    // Excluded outright — raising the count must never resurrect it.
    expect(outcome.extraIds).not.toContain('k2');
  });

  it('always includes items the user said they know, even past the cut', () => {
    const answers = [
      answer(kanji[9], true),
      answer(kanji[0], false),
      answer(kanji[1], false),
      answer(kanji[2], false),
    ];
    const [outcome] = resolvePlacementOutcomes(byLevel, answers);
    expect(outcome.knownIds).toContain('k10');
    // Explicit answers survive a hand-lowered count: they sort first.
    expect(outcome.knownIds[0]).toBe('k10');
  });

  it('marks nothing when every answer is unknown', () => {
    const answers = [answer(kanji[0], false), answer(kanji[4], false)];
    const [outcome] = resolvePlacementOutcomes(byLevel, answers);
    expect(outcome.knownIds).toEqual([]);
  });

  it('applies each item type cutoff independently', () => {
    const kanjiItems = items('kanji', 10, 'k', 'N5');
    const vocabularyItems = items('vocabulary', 10, 'v', 'N5');
    const pool = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', [...kanjiItems, ...vocabularyItems]],
    ]);

    const answers = [
      answer(kanjiItems[0], true),
      answer(kanjiItems[4], true),
      answer(vocabularyItems[0], false),
      answer(vocabularyItems[4], false),
    ];

    const outcomes = resolvePlacementOutcomes(pool, answers);
    // Kanji ratio 1.0 → all ten; vocabulary ratio 0 → none. A blended 0.5 would
    // have marked five of each.
    expect(outcomes.map((outcome) => outcome.itemType)).toEqual(['kanji', 'vocabulary']);
    expect(outcomes[0].knownIds).toHaveLength(10);
    expect(outcomes[1].knownIds).toHaveLength(0);
  });

  it('reports one outcome per level and type cell, in canonical order', () => {
    const pool = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', [...items('grammar', 4, 'g5', 'N5'), ...items('radical', 4, 'r5', 'N5')]],
      ['N4', items('kanji', 4, 'k4', 'N4')],
    ]);

    const outcomes = resolvePlacementOutcomes(pool, []);
    // Levels N5 → N1, types radical → grammar, whatever order the caller grouped
    // them in. Cells the range does not contain are simply absent.
    expect(outcomes.map((outcome) => `${outcome.level}:${outcome.itemType}`)).toEqual([
      'N5:radical',
      'N5:grammar',
      'N4:kanji',
    ]);
  });

  it('applies each level cutoff independently', () => {
    const n5 = items('kanji', 10, 'k5', 'N5');
    const n4 = items('kanji', 10, 'k4', 'N4');
    const pool = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', n5],
      ['N4', n4],
    ]);

    const answers = [answer(n5[0], true), answer(n5[4], true), answer(n4[0], false)];

    const outcomes = resolvePlacementOutcomes(pool, answers);
    expect(outcomes.map((outcome) => outcome.level)).toEqual(['N5', 'N4']);
    // Aced N5 → all ten; struggled N4 → none. One flat ratio would have split both.
    expect(outcomes[0].knownIds).toHaveLength(10);
    expect(outcomes[1].knownIds).toHaveLength(0);
  });

  it('leaves a level and type pair with no sampled items untouched', () => {
    const kanjiItems = items('kanji', 4, 'k', 'N5');
    const grammarItems = items('grammar', 4, 'g', 'N5');
    const pool = new Map<JLPTLevel, PlacementSampleItem[]>([
      ['N5', [...kanjiItems, ...grammarItems]],
      ['N4', []],
    ]);

    const outcomes = resolvePlacementOutcomes(pool, [answer(kanjiItems[0], true)]);
    // Grammar was never sampled → no cutoff there; the empty N4 level yields no
    // cells at all, so there is nothing to render or adjust.
    expect(outcomes.map((outcome) => `${outcome.level}:${outcome.itemType}`)).toEqual([
      'N5:kanji',
      'N5:grammar',
    ]);
    expect(outcomes[0].knownIds).toEqual(['k1', 'k2', 'k3', 'k4']);
    expect(outcomes[1].knownIds).toEqual([]);
  });

  it('offers the remaining items as ordered extras for a hand-raised count', () => {
    const answers = [answer(kanji[0], true), answer(kanji[8], false)];
    const [outcome] = resolvePlacementOutcomes(byLevel, answers);
    expect(outcome.knownIds).toHaveLength(5);
    // 10 items − 5 known − 1 explicit unknown
    expect(outcome.extraIds).toEqual(['k6', 'k7', 'k8', 'k10']);
  });
});
