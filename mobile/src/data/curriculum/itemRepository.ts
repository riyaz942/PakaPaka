import type { SQLiteDatabase } from 'expo-sqlite';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';

export type ItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export const ITEM_TYPES: readonly ItemType[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
] as const;

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
};

export type CurriculumListItem = {
  id: string;
  slug: string;
  primaryForm: string;
  meaning: string;
  itemType: ItemType;
  sortOrder: number;
};

export type CurriculumItemDetail = {
  id: string;
  slug: string;
  itemType: ItemType;
  jlptLevel: JLPTLevel;
  primaryForm: string;
  meaning: string;
  mnemonicText: string | null;
  visualMnemonicUrl: string | null;
};

export type CurriculumParentItem = {
  id: string;
  primaryForm: string;
  itemType: ItemType;
};

type ItemRow = {
  id: number | string;
  slug: string;
  primary_form: string;
  meaning: string;
  item_type: ItemType;
  sort_order: number;
};

function mapRowToListItem(row: ItemRow): CurriculumListItem {
  return {
    id: String(row.id),
    slug: row.slug,
    primaryForm: row.primary_form,
    meaning: row.meaning,
    itemType: row.item_type,
    sortOrder: row.sort_order,
  };
}

export function countItemsByLevelAndType(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
  itemType: ItemType,
): number {
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM items WHERE item_type = ? AND jlpt_level = ?`,
    itemType,
    jlptLevel,
  );
  return row?.count ?? 0;
}

export function countItemsByLevel(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
): Record<ItemType, number> {
  const rows = db.getAllSync<{ item_type: ItemType; count: number }>(
    `SELECT item_type, COUNT(*) AS count
     FROM items
     WHERE jlpt_level = ?
     GROUP BY item_type`,
    jlptLevel,
  );

  const counts: Record<ItemType, number> = {
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    grammar: 0,
  };

  for (const row of rows) {
    counts[row.item_type] = row.count;
  }

  return counts;
}

export function listItemsByLevelAndType(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
  itemType: ItemType,
): CurriculumListItem[] {
  const rows = db.getAllSync<ItemRow>(
    `SELECT id, slug, primary_form, meaning, item_type, sort_order
     FROM items
     WHERE item_type = ? AND jlpt_level = ?
     ORDER BY sort_order ASC`,
    itemType,
    jlptLevel,
  );

  return rows.map(mapRowToListItem);
}

type ItemDetailRow = {
  id: number | string;
  slug: string;
  item_type: ItemType;
  jlpt_level: JLPTLevel;
  primary_form: string;
  meaning: string;
  mnemonic_text: string | null;
  visual_mnemonic_url: string | null;
};

function mapRowToDetail(row: ItemDetailRow): CurriculumItemDetail {
  return {
    id: String(row.id),
    slug: row.slug,
    itemType: row.item_type,
    jlptLevel: row.jlpt_level,
    primaryForm: row.primary_form,
    meaning: row.meaning,
    mnemonicText: row.mnemonic_text,
    visualMnemonicUrl: row.visual_mnemonic_url,
  };
}

export function getItemById(
  db: SQLiteDatabase,
  id: string,
): CurriculumItemDetail | null {
  const row = db.getFirstSync<ItemDetailRow>(
    `SELECT id, slug, item_type, jlpt_level, primary_form, meaning, mnemonic_text, visual_mnemonic_url
     FROM items WHERE id = ?`,
    Number(id),
  );
  return row ? mapRowToDetail(row) : null;
}

type ParentRow = {
  child_item_id: number | string;
  id: number | string;
  primary_form: string;
  meaning: string;
  item_type: ItemType;
  sort_order: number;
};

function mapParentRow(row: ParentRow): CurriculumParentItem {
  return {
    id: String(row.id),
    primaryForm: row.primary_form || row.meaning,
    itemType: row.item_type,
  };
}

export function getRequiredParentLabels(
  db: SQLiteDatabase,
  itemId: string,
): string[] {
  return getRequiredParentLabelsForItems(db, [itemId]).get(itemId) ?? [];
}

export function getRequiredParentsForItems(
  db: SQLiteDatabase,
  itemIds: string[],
): Map<string, CurriculumParentItem[]> {
  const result = new Map<string, CurriculumParentItem[]>();

  if (itemIds.length === 0) {
    return result;
  }

  const numericIds = itemIds.map((itemId) => Number(itemId));
  const placeholders = numericIds.map(() => '?').join(', ');

  const rows = db.getAllSync<ParentRow>(
    `SELECT r.child_item_id, p.id, p.primary_form, p.meaning, p.item_type, p.sort_order
     FROM item_relationships r
     JOIN items p ON p.id = r.parent_item_id
     WHERE r.child_item_id IN (${placeholders}) AND r.relationship_type = 'requires'
     ORDER BY r.child_item_id ASC, p.sort_order ASC`,
    ...numericIds,
  );

  for (const row of rows) {
    const itemId = String(row.child_item_id);
    const parents = result.get(itemId) ?? [];
    parents.push(mapParentRow(row));
    result.set(itemId, parents);
  }

  return result;
}

export function getRequiredParentLabelsForItems(
  db: SQLiteDatabase,
  itemIds: string[],
): Map<string, string[]> {
  const parentsByItemId = getRequiredParentsForItems(db, itemIds);
  const result = new Map<string, string[]>();

  for (const [itemId, parents] of parentsByItemId) {
    result.set(
      itemId,
      parents.map((parent) => parent.primaryForm),
    );
  }

  return result;
}
