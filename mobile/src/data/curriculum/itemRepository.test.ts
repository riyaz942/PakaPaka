import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetItemRelationships,
  __mockSetItems,
} from '../../../__mocks__/expo-sqlite';

import {
  countItemsByLevel,
  countItemsByLevelAndType,
  getItemById,
  getRequiredParentLabels,
  getRequiredParentLabelsForItems,
  getRequiredParentsForItems,
  ITEM_TYPES,
  listItemsByLevelAndType,
} from '@/data/curriculum/itemRepository';

const N5_COUNTS: Record<(typeof ITEM_TYPES)[number], number> = {
  radical: 25,
  kanji: 32,
  vocabulary: 41,
  grammar: 16,
};

function buildN5Items() {
  const items = [];
  let id = 1;

  for (const itemType of ITEM_TYPES) {
    const count = N5_COUNTS[itemType];
    for (let index = 0; index < count; index += 1) {
      items.push({
        id,
        item_type: itemType,
        jlpt_level: 'N5',
        slug: `${itemType}-${id}`,
        primary_form: `${itemType}-${id}`,
        meaning: `meaning-${id}`,
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: index + 1,
      });
      id += 1;
    }
  }

  return items;
}

describe('itemRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('returns N5 items per type ordered by sort_order', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', buildN5Items());

    for (const itemType of ITEM_TYPES) {
      const items = listItemsByLevelAndType(db, 'N5', itemType);
      expect(items).toHaveLength(N5_COUNTS[itemType]);
      expect(items[0]?.itemType).toBe(itemType);
      expect(items[0]?.sortOrder).toBe(1);
      expect(items.at(-1)?.sortOrder).toBe(N5_COUNTS[itemType]);
    }
  });

  it('returns count by level and type without loading full lists', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');
    __mockSetItems('curriculum.db.test', buildN5Items());

    for (const itemType of ITEM_TYPES) {
      expect(countItemsByLevelAndType(db, 'N5', itemType)).toBe(N5_COUNTS[itemType]);
    }

    const batchCounts = countItemsByLevel(db, 'N5');
    expect(batchCounts).toEqual(N5_COUNTS);
  });

  it('returns required parent labels for single and batched kanji ids', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '日',
        meaning: 'sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 11,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'book',
        primary_form: '本',
        meaning: 'book',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        child_item_id: 10,
        parent_item_id: 1,
        relationship_type: 'requires',
      },
    ]);

    expect(getRequiredParentLabels(db, '10')).toEqual(['日']);
    expect(getRequiredParentLabelsForItems(db, ['10', '11']).get('10')).toEqual(['日']);
    expect(getRequiredParentLabelsForItems(db, ['10', '11']).has('11')).toBe(false);
  });

  it('returns item detail by id', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'one',
        primary_form: '一',
        meaning: 'one',
        mnemonic_text: 'Radical one (一)',
        visual_mnemonic_url: 'https://example.com/one.png',
        sort_order: 1,
      },
    ]);

    const detail = getItemById(db, '1');
    expect(detail).toEqual({
      id: '1',
      slug: 'one',
      itemType: 'radical',
      jlptLevel: 'N5',
      primaryForm: '一',
      meaning: 'one',
      mnemonicText: 'Radical one (一)',
      visualMnemonicUrl: 'https://example.com/one.png',
    });
    expect(getItemById(db, '999')).toBeNull();
  });

  it('returns required parents with ids for batched kanji ids', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '日',
        meaning: 'sun',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'mouth',
        primary_form: '口',
        meaning: 'mouth',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 2,
      },
      {
        id: 10,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    __mockSetItemRelationships('curriculum.db.test', [
      {
        child_item_id: 10,
        parent_item_id: 1,
        relationship_type: 'requires',
      },
      {
        child_item_id: 10,
        parent_item_id: 2,
        relationship_type: 'requires',
      },
    ]);

    const parents = getRequiredParentsForItems(db, ['10']);
    expect(parents.get('10')).toEqual([
      { id: '1', primaryForm: '日', itemType: 'radical' },
      { id: '2', primaryForm: '口', itemType: 'radical' },
    ]);
  });
});
