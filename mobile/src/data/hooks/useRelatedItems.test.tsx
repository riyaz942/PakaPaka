import { renderHook } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React, { type ReactNode } from 'react';

import { __mockResetSqlite, __mockSetItemRelationships, __mockSetItems } from '../../../__mocks__/expo-sqlite';

import type { ItemType } from '@/data/curriculum/itemRepository';
import { useRelatedItems } from '@/data/hooks/useRelatedItems';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

function row(id: number, itemType: ItemType, primaryForm: string, sortOrder = 1) {
  return {
    id,
    item_type: itemType,
    jlpt_level: 'N5',
    slug: `slug-${id}`,
    primary_form: primaryForm,
    meaning: `meaning-${id}`,
    mnemonic_text: null,
    visual_mnemonic_url: null,
    sort_order: sortOrder,
  };
}

async function createDb() {
  const curriculumDb = await openDatabaseAsync('curriculum.db.test');
  const userDb = await openDatabaseAsync('user.db');

  __mockSetItems('curriculum.db.test', [
    row(1, 'radical', '一'),
    row(2, 'kanji', '日'),
    row(3, 'vocabulary', '毎日'),
    row(4, 'grammar', 'です'),
    row(5, 'vocabulary', '学生', 2),
  ]);

  __mockSetItemRelationships('curriculum.db.test', [
    { parent_item_id: 1, child_item_id: 2, relationship_type: 'builds_on' },
    { parent_item_id: 2, child_item_id: 3, relationship_type: 'requires' },
    { parent_item_id: 4, child_item_id: 5, relationship_type: 'reinforces' },
  ]);

  return { curriculumDb, userDb };
}

function renderRelated(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  itemId: string | null,
  itemType: ItemType | null,
) {
  const contextValue = {
    curriculumDb,
    userDb,
    isReady: true,
    error: null,
  } as unknown as DatabaseContextValue;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>
    );
  }

  return renderHook(() => useRelatedItems(itemId, itemType), { wrapper: Wrapper });
}

describe('useRelatedItems', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('returns example kanji for a radical (builds_on)', async () => {
    const { curriculumDb, userDb } = await createDb();

    const { result } = renderRelated(curriculumDb, userDb, '1', 'radical');

    expect(result.current).toEqual([
      {
        id: '2',
        itemType: 'kanji',
        primaryForm: '日',
        meaning: 'meaning-2',
        relationshipType: 'builds_on',
      },
    ]);
  });

  it('returns vocabulary using a kanji (requires)', async () => {
    const { curriculumDb, userDb } = await createDb();

    const { result } = renderRelated(curriculumDb, userDb, '2', 'kanji');

    expect(result.current.map((entry) => entry.id)).toEqual(['3']);
    expect(result.current[0].itemType).toBe('vocabulary');
  });

  it('returns vocabulary an out-of-band kanji is written in (builds_on)', async () => {
    const { curriculumDb, userDb } = await createDb();
    // A kanji banded later than the word it appears in holds the non-gating
    // edge (plan v2 Phase C). The word still uses the kanji, so it still lists.
    __mockSetItemRelationships('curriculum.db.test', [
      { parent_item_id: 1, child_item_id: 2, relationship_type: 'builds_on' },
      { parent_item_id: 2, child_item_id: 3, relationship_type: 'requires' },
      { parent_item_id: 2, child_item_id: 5, relationship_type: 'builds_on' },
    ]);

    const { result } = renderRelated(curriculumDb, userDb, '2', 'kanji');

    // The radical's own kanji child is not swept in — the child type still filters.
    expect(result.current.map((entry) => entry.id)).toEqual(['3', '5']);
    expect(result.current.every((entry) => entry.itemType === 'vocabulary')).toBe(true);
  });

  it('returns nothing for grammar — its example words are tappable in place', async () => {
    const { curriculumDb, userDb } = await createDb();

    const { result } = renderRelated(curriculumDb, userDb, '4', 'grammar');

    expect(result.current).toEqual([]);
  });

  it('returns nothing for vocabulary — its cross-refs are parents and grammar links', async () => {
    const { curriculumDb, userDb } = await createDb();

    const { result } = renderRelated(curriculumDb, userDb, '3', 'vocabulary');

    expect(result.current).toEqual([]);
  });

  it('returns nothing for a leaf item or a missing id', async () => {
    const { curriculumDb, userDb } = await createDb();

    expect(renderRelated(curriculumDb, userDb, '5', 'vocabulary').result.current).toEqual([]);
    expect(renderRelated(curriculumDb, userDb, null, 'kanji').result.current).toEqual([]);
  });
});
