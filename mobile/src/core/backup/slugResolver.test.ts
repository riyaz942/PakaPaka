import {
  buildItemIdToRefMap,
  buildItemRefToIdMap,
  itemRefKey,
  resolveItemIdToRef,
  resolveItemRefToId,
  type CurriculumItemLookupRow,
} from '@/core/backup/slugResolver';

const OLD_CURRICULUM: CurriculumItemLookupRow[] = [
  { id: 1, itemType: 'radical', slug: 'one' },
  { id: 2, itemType: 'kanji', slug: 'sun' },
  { id: 3, itemType: 'vocabulary', slug: 'nichiyoubi' },
];

// Same slugs, ids shifted by a recompile — the scenario AC1 exists to prevent.
const NEW_CURRICULUM: CurriculumItemLookupRow[] = [
  { id: 101, itemType: 'radical', slug: 'one' },
  { id: 102, itemType: 'kanji', slug: 'sun' },
  { id: 103, itemType: 'vocabulary', slug: 'nichiyoubi' },
];

describe('itemRefKey', () => {
  it('combines item type and slug', () => {
    expect(itemRefKey({ itemType: 'kanji', slug: 'sun' })).toBe('kanji:sun');
  });
});

describe('buildItemIdToRefMap / resolveItemIdToRef', () => {
  it('resolves a known id to its slug ref', () => {
    const map = buildItemIdToRefMap(OLD_CURRICULUM);
    expect(resolveItemIdToRef(map, 2)).toEqual({ itemType: 'kanji', slug: 'sun' });
  });

  it('resolves string sqlite ids the same as numeric ids', () => {
    const map = buildItemIdToRefMap([
      { id: '2', itemType: 'kanji', slug: 'sun' },
    ]);
    expect(resolveItemIdToRef(map, '2')).toEqual({ itemType: 'kanji', slug: 'sun' });
    expect(resolveItemIdToRef(map, 2)).toEqual({ itemType: 'kanji', slug: 'sun' });
  });

  it('returns null for an unknown id', () => {
    const map = buildItemIdToRefMap(OLD_CURRICULUM);
    expect(resolveItemIdToRef(map, 999)).toBeNull();
  });
});

describe('buildItemRefToIdMap / resolveItemRefToId', () => {
  it('resolves a known ref back to its id', () => {
    const map = buildItemRefToIdMap(NEW_CURRICULUM);
    expect(resolveItemRefToId(map, { itemType: 'kanji', slug: 'sun' })).toBe(102);
  });

  it('returns null for an unknown ref', () => {
    const map = buildItemRefToIdMap(NEW_CURRICULUM);
    expect(resolveItemRefToId(map, { itemType: 'kanji', slug: 'moon' })).toBeNull();
  });
});

describe('id-shift round trip (justifies AC1 slug keying)', () => {
  it('lands on the same logical item after ids shift on recompile', () => {
    const oldIdToRef = buildItemIdToRefMap(OLD_CURRICULUM);
    const newRefToId = buildItemRefToIdMap(NEW_CURRICULUM);

    // Export time: progress was recorded against the old integer id.
    const exportedItemId = 2;
    const ref = resolveItemIdToRef(oldIdToRef, exportedItemId);
    expect(ref).not.toBeNull();

    // "Restore" time: the curriculum was recompiled and ids shifted.
    const resolvedNewId = resolveItemRefToId(newRefToId, ref!);

    expect(resolvedNewId).toBe(102);
    expect(resolvedNewId).not.toBe(exportedItemId);
  });
});
