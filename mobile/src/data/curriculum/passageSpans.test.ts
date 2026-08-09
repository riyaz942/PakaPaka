import { openDatabaseAsync } from 'expo-sqlite';

import {
  __mockResetSqlite,
  __mockSetPassageWordSpans,
} from '../../../__mocks__/expo-sqlite';

import { getPassageWordSpans } from '@/data/curriculum/passageSpans';

describe('passageSpans', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function seedSpans() {
    const db = await openDatabaseAsync('curriculum.db.test');

    __mockSetPassageWordSpans('curriculum.db.test', [
      {
        id: 2,
        passage_id: 1,
        vocabulary_item_id: 11,
        start_offset: 2,
        end_offset: 4,
        inflection: null,
        sort_order: 1,
      },
      {
        id: 1,
        passage_id: 1,
        vocabulary_item_id: 10,
        start_offset: 0,
        end_offset: 1,
        inflection: null,
        sort_order: 0,
      },
      {
        id: 3,
        passage_id: 2,
        vocabulary_item_id: 12,
        start_offset: 0,
        end_offset: 1,
        // A taught inflection resolving to the *base* item (14.1a).
        inflection: 'masu',
        sort_order: 0,
      },
    ]);

    return db;
  }

  it('returns a passage word spans in body order', async () => {
    const db = await seedSpans();

    expect(getPassageWordSpans(db, '1')).toEqual([
      { vocabularyItemId: '10', startOffset: 0, endOffset: 1, inflection: null },
      { vocabularyItemId: '11', startOffset: 2, endOffset: 4, inflection: null },
    ]);
  });

  it('does not leak spans from other passages', async () => {
    const db = await seedSpans();

    expect(getPassageWordSpans(db, '2')).toEqual([
      { vocabularyItemId: '12', startOffset: 0, endOffset: 1, inflection: 'masu' },
    ]);
  });

  it('returns an empty list for a passage with no authored spans', async () => {
    const db = await seedSpans();

    expect(getPassageWordSpans(db, '3')).toEqual([]);
  });
});
