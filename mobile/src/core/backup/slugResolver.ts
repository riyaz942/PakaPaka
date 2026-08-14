import type { ItemRef } from '@/core/backup/backup.types';
import type { ItemType } from '@/data/curriculum/itemRepository';

/** One row of `curriculum.items`, already read by the data layer. */
export type CurriculumItemLookupRow = {
  id: number | string;
  itemType: ItemType;
  slug: string;
};

export function itemRefKey(ref: ItemRef): string {
  return `${ref.itemType}:${ref.slug}`;
}

function toItemId(id: number | string): number | null {
  const parsed = Number(id);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** `itemId -> {item_type, slug}`, used to resolve export rows to slugs. */
export function buildItemIdToRefMap(rows: CurriculumItemLookupRow[]): Map<number, ItemRef> {
  const map = new Map<number, ItemRef>();
  for (const row of rows) {
    const id = toItemId(row.id);
    if (id === null) continue;
    map.set(id, { itemType: row.itemType, slug: row.slug });
  }
  return map;
}

/** `{item_type, slug} -> itemId`, the reverse direction a future restore needs. */
export function buildItemRefToIdMap(rows: CurriculumItemLookupRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = toItemId(row.id);
    if (id === null) continue;
    map.set(itemRefKey({ itemType: row.itemType, slug: row.slug }), id);
  }
  return map;
}

export function resolveItemIdToRef(
  idToRefMap: ReadonlyMap<number, ItemRef>,
  itemId: number | string,
): ItemRef | null {
  const id = toItemId(itemId);
  if (id === null) return null;
  return idToRefMap.get(id) ?? null;
}

export function resolveItemRefToId(
  refToIdMap: ReadonlyMap<string, number>,
  ref: ItemRef,
): number | null {
  return refToIdMap.get(itemRefKey(ref)) ?? null;
}
