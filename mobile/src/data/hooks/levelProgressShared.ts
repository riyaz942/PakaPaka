import type { SQLiteDatabase } from 'expo-sqlite';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { countItemsByLevel, listItemsByLevelAndType, type ItemType } from '@/data/curriculum/itemRepository';
import { countStartedItemsByIds } from '@/data/user/srsStateRepository';

export type ItemProgressCategory = ItemType;

export type CategoryProgress = {
  started: number;
  total: number;
};

export function computeItemCategoryProgress(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  level: JLPTLevel,
  categories: readonly ItemProgressCategory[],
): Record<ItemProgressCategory, CategoryProgress> {
  const totals = countItemsByLevel(curriculumDb, level);
  const result = {} as Record<ItemProgressCategory, CategoryProgress>;

  for (const category of categories) {
    const total = totals[category];
    const items = listItemsByLevelAndType(curriculumDb, level, category);
    const started = countStartedItemsByIds(userDb, items.map((item) => item.id));
    result[category] = { started, total };
  }

  return result;
}
