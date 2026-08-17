import { useMemo } from 'react';

import type { RelatedItem } from '@/core/content/content.types';
import { getRelatedItemsForItems, type ItemType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

/**
 * Type-appropriate graph children for one item (FR72), read straight from
 * `item_relationships` — no parallel relationship table, no curated lookalikes.
 *
 * | Viewing    | Edge                                 | Reads as                       |
 * | ---------- | ------------------------------------ | ------------------------------ |
 * | radical    | `builds_on` → kanji                  | kanji built from this radical  |
 * | kanji      | `requires`/`builds_on` → vocabulary  | vocabulary using this kanji    |
 * | grammar    | `reinforces` → vocabulary            | vocabulary using this pattern  |
 * | vocabulary | _(none)_                             | components come from parents   |
 *
 * A kanji reads both of its vocabulary edges: since plan v2 Phase C, a word
 * whose kanji is banded later than the word itself carries the non-gating
 * `builds_on` form instead of `requires` (see `generate_deps.py`). The question
 * here is which words use the kanji, not which words it gates, so both count.
 *
 * Vocabulary's own cross-refs are its component kanji (graph *parents*, via
 * `useComponentParents`) and its grammar links (`getGrammarLinksForVocab`),
 * so there is nothing to fetch here for it.
 */
const RELATED_EDGE_BY_TYPE: Record<
  ItemType,
  { relationshipTypes: RelatedItem['relationshipType'][]; childType: ItemType } | null
> = {
  radical: { relationshipTypes: ['builds_on'], childType: 'kanji' },
  kanji: { relationshipTypes: ['requires', 'builds_on'], childType: 'vocabulary' },
  grammar: { relationshipTypes: ['reinforces'], childType: 'vocabulary' },
  vocabulary: null,
};

export function useRelatedItems(
  itemId: string | null,
  itemType: ItemType | null,
): RelatedItem[] {
  const { curriculumDb } = useDatabase();

  return useMemo(() => {
    const edge = itemType ? RELATED_EDGE_BY_TYPE[itemType] : null;
    if (!itemId || !edge) {
      return [];
    }

    const children = getRelatedItemsForItems(curriculumDb, [itemId]).get(itemId) ?? [];
    return children.filter(
      (child) =>
        edge.relationshipTypes.includes(child.relationshipType) &&
        child.itemType === edge.childType,
    );
  }, [curriculumDb, itemId, itemType]);
}
