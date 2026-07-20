import { listNeededItemsForPassage } from '@/core/content/passageNeededItems';

import type { SRSStageLabel } from '@/core/srs/srs.types';

function stages(entries: Record<string, SRSStageLabel>): Map<string, SRSStageLabel> {
  return new Map(Object.entries(entries));
}

describe('listNeededItemsForPassage', () => {
  it('returns linked items whose stage is below Guru', () => {
    const needed = listNeededItemsForPassage(
      ['a', 'b', 'c'],
      stages({ a: 'guru', b: 'apprentice', c: 'apprentice' }),
    );

    expect(needed).toEqual(['b', 'c']);
  });

  it('treats every Guru-or-above stage as covered', () => {
    const needed = listNeededItemsForPassage(
      ['a', 'b', 'c', 'd'],
      stages({ a: 'guru', b: 'master', c: 'enlightened', d: 'burned' }),
    );

    expect(needed).toEqual([]);
  });

  it('treats items with no SRS state at all as needed', () => {
    const needed = listNeededItemsForPassage(['a', 'b'], stages({ a: 'guru' }));

    expect(needed).toEqual(['b']);
  });

  it('preserves the linked order and de-duplicates repeated ids', () => {
    const needed = listNeededItemsForPassage(
      ['c', 'a', 'c', 'b'],
      stages({ a: 'guru', b: 'apprentice', c: 'apprentice' }),
    );

    expect(needed).toEqual(['c', 'b']);
  });

  it('returns an empty list when the passage has no links', () => {
    expect(listNeededItemsForPassage([], stages({}))).toEqual([]);
  });
});
