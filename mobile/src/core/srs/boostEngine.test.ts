import { RELATED_ITEM_BOOST_DELTA } from '@/config/constants';

import { computeBoosts } from './boostEngine';
import type { RelatedItem } from '@/core/content/content.types';

function makeRelated(id: string): RelatedItem {
  return {
    id,
    itemType: 'vocabulary',
    primaryForm: `form-${id}`,
    meaning: `meaning-${id}`,
    relationshipType: 'reinforces',
  };
}

describe('computeBoosts', () => {
  it('returns empty array when no related items', () => {
    expect(computeBoosts([])).toEqual([]);
  });

  it('returns one delta per unique related item', () => {
    const related = [makeRelated('1'), makeRelated('2')];
    expect(computeBoosts(related)).toEqual([
      { itemId: '1', delta: RELATED_ITEM_BOOST_DELTA },
      { itemId: '2', delta: RELATED_ITEM_BOOST_DELTA },
    ]);
  });

  it('deduplicates related item ids', () => {
    const related = [makeRelated('1'), makeRelated('1')];
    expect(computeBoosts(related)).toEqual([{ itemId: '1', delta: RELATED_ITEM_BOOST_DELTA }]);
  });

  it('respects custom delta option', () => {
    expect(computeBoosts([makeRelated('1')], { delta: 0.5 })).toEqual([
      { itemId: '1', delta: 0.5 },
    ]);
  });
});
