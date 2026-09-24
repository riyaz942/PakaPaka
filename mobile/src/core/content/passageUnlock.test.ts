import { computePassageUnlock } from './passageUnlock';

import type { SRSStageLabel } from '@/core/srs/srs.types';

function stages(entries: Record<string, SRSStageLabel>): Map<string, SRSStageLabel> {
  return new Map(Object.entries(entries));
}

describe('computePassageUnlock', () => {
  it('treats an empty linked set as locked with zero counts', () => {
    const status = computePassageUnlock([], stages({}));

    expect(status.unlocked).toBe(false);
    expect(status.linkedCount).toBe(0);
    expect(status.itemsRemainingToUnlock).toBe(0);
  });

  it('unlocks at exactly the 90% threshold', () => {
    // 9 of 10 at guru+ → coverage 0.9 exactly.
    const ids = Array.from({ length: 10 }, (_, i) => String(i + 1));
    const map = stages(
      Object.fromEntries(ids.slice(0, 9).map((id) => [id, 'guru' as SRSStageLabel])),
    );

    const status = computePassageUnlock(ids, map);
    expect(status.unlocked).toBe(true);
    expect(status.guruOrAboveCount).toBe(9);
    expect(status.itemsRemainingToUnlock).toBe(0);
  });

  it('a single leech cannot block a large passage (90%, not 100%)', () => {
    // 19 of 20 at guru+ → 95% ≥ 90% → unlocked despite one apprentice leech.
    const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
    const map = stages(
      Object.fromEntries(ids.slice(0, 19).map((id) => [id, 'master' as SRSStageLabel])),
    );

    expect(computePassageUnlock(ids, map).unlocked).toBe(true);
  });

  it('counts burned as covered and unstarted items as uncovered', () => {
    const status = computePassageUnlock(
      ['1', '2', '3', '4'],
      stages({ '1': 'burned', '2': 'enlightened', '3': 'apprentice' }),
    );

    // 2 of 4 covered → 50%; need ceil(4 × 0.9) = 4 → 2 more.
    expect(status.unlocked).toBe(false);
    expect(status.guruOrAboveCount).toBe(2);
    expect(status.itemsRemainingToUnlock).toBe(2);
  });

  it('computes itemsRemainingToUnlock with ceil math', () => {
    // 10 linked, 5 covered: need ceil(9) = 9 → 4 remaining.
    const ids = Array.from({ length: 10 }, (_, i) => String(i + 1));
    const map = stages(
      Object.fromEntries(ids.slice(0, 5).map((id) => [id, 'guru' as SRSStageLabel])),
    );

    expect(computePassageUnlock(ids, map).itemsRemainingToUnlock).toBe(4);
  });

  it('counts items marked known as covered, with or without an SRS state', () => {
    // 1 guru + 2 known (one never reviewed, one still apprentice) of 4 → 3 covered.
    const status = computePassageUnlock(
      ['1', '2', '3', '4'],
      stages({ '1': 'guru', '3': 'apprentice' }),
      new Set(['2', '3']),
    );

    expect(status.guruOrAboveCount).toBe(3);
    expect(status.itemsRemainingToUnlock).toBe(1);
  });
});
