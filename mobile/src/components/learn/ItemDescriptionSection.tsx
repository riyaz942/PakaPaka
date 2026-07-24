import React from 'react';
import { Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import type { CurriculumItemDetail, ItemType } from '@/data/curriculum/itemRepository';

const DESCRIPTION_LABEL: Partial<Record<ItemType, string>> = {
  radical: 'About this radical',
  kanji: 'About this kanji',
  vocabulary: 'About this word',
};

/**
 * The item's `description` (content pipeline Rev 1): meaning nuance, glyph
 * description, and — on radicals/kanji with look-alikes — how to tell them
 * apart. Grammar teaches through `explanation_markdown` instead and never
 * carries one.
 */
export function ItemDescriptionSection({ item }: { item: CurriculumItemDetail }) {
  const label = DESCRIPTION_LABEL[item.itemType];

  if (!item.description || !label) {
    return null;
  }

  return (
    <View className="mt-4" testID="item-description">
      <SectionHeading label={label} />
      <Text className="mt-1 text-body text-primary">{item.description}</Text>
    </View>
  );
}
