import React from 'react';
import { Text, View } from 'react-native';

import type { CurriculumListItem } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type LearnItemRowProps = {
  item: CurriculumListItem;
  testID?: string;
};

export function LearnItemRow({ item, testID }: LearnItemRowProps) {
  const isGrammar = item.itemType === 'grammar';
  const isJapaneseForm = item.itemType === 'radical' || item.itemType === 'kanji';

  return (
    <View testID={testID} className="border-b border-border py-4">
      <Text
        className={cn(
          isJapaneseForm ? 'text-display text-primary' : 'text-body text-primary',
          isGrammar && 'font-mono',
        )}>
        {item.primaryForm}
      </Text>
      <Text className="mt-1 text-body text-primary">{item.meaning}</Text>
    </View>
  );
}
