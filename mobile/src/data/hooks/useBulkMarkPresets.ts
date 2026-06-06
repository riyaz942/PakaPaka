import { useEffect, useState } from 'react';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  listItemsByLevelAndType,
  type ItemType,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getStartingJlptLevel } from '@/data/user/preferencesRepository';

export type BulkMarkPresetKind = ItemType | 'everything';

export type BulkMarkPreset = {
  kind: BulkMarkPresetKind;
  title: string;
  count: number;
  itemIds: string[];
  confirmTypeLabel: string;
  successTypeLabel: string;
};

function pluralizeTypeLabel(type: ItemType, count: number): string {
  const singular = type === 'radical' ? 'radical' : type === 'kanji' ? 'kanji' : type;
  if (count === 1) {
    if (type === 'vocabulary') {
      return 'vocabulary word';
    }
    if (type === 'grammar') {
      return 'grammar point';
    }
    return singular;
  }

  if (type === 'vocabulary') {
    return 'vocabulary words';
  }
  if (type === 'grammar') {
    return 'grammar points';
  }
  if (type === 'radical') {
    return 'radicals';
  }
  return 'kanji';
}

export function useBulkMarkPresets(): {
  presets: BulkMarkPreset[];
  loading: boolean;
  jlptLevel: JLPTLevel | null;
} {
  const { curriculumDb, userDb } = useDatabase();
  const jlptLevel = getStartingJlptLevel(userDb);
  const [presets, setPresets] = useState<BulkMarkPreset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jlptLevel) {
      setPresets([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const typePresets: BulkMarkPreset[] = [];

    for (const itemType of ITEM_TYPES) {
      const items = listItemsByLevelAndType(curriculumDb, jlptLevel, itemType);
      if (items.length === 0) {
        continue;
      }

      typePresets.push({
        kind: itemType,
        title: `All ${jlptLevel} ${ITEM_TYPE_LABELS[itemType]}`,
        count: items.length,
        itemIds: items.map((item) => item.id),
        confirmTypeLabel: pluralizeTypeLabel(itemType, items.length),
        successTypeLabel: pluralizeTypeLabel(itemType, items.length),
      });
    }

    const allItemIds = typePresets.flatMap((preset) => preset.itemIds);
    const uniqueItemIds = [...new Set(allItemIds)];

    if (uniqueItemIds.length > 0) {
      const itemLabel = uniqueItemIds.length === 1 ? 'item' : 'items';
      typePresets.push({
        kind: 'everything',
        title: `Everything at ${jlptLevel}`,
        count: uniqueItemIds.length,
        itemIds: uniqueItemIds,
        confirmTypeLabel: itemLabel,
        successTypeLabel: itemLabel,
      });
    }

    setPresets(typePresets);
    setLoading(false);
  }, [curriculumDb, jlptLevel]);

  return { presets, loading, jlptLevel };
}
