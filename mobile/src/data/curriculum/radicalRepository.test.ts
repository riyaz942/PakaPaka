import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import { listRadicalsByLevel } from '@/data/curriculum/radicalRepository';

describe('radicalRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('returns N5 radicals ordered by sort_order with mapped fields', async () => {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetItems('curriculum.db.test', [
      {
        id: 2,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'ni',
        primary_form: '二',
        meaning: 'two',
        mnemonic_text: 'Radical two (二)',
        visual_mnemonic_url: 'radicals/n5/ni.webp',
        sort_order: 2,
      },
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'ichi',
        primary_form: '一',
        meaning: 'one',
        mnemonic_text: 'Radical one (一)',
        visual_mnemonic_url: 'radicals/n5/ichi.webp',
        sort_order: 1,
      },
      {
        id: 99,
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

    const radicals = listRadicalsByLevel(db, 'N5');

    expect(radicals).toHaveLength(2);
    expect(radicals[0]).toEqual({
      id: '1',
      slug: 'ichi',
      primaryForm: '一',
      meaning: 'one',
      mnemonicText: 'Radical one (一)',
      visualMnemonicUrl: 'radicals/n5/ichi.webp',
      sortOrder: 1,
    });
    expect(radicals[1]?.slug).toBe('ni');
  });
});
