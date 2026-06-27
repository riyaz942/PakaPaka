import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { KanjiDependencyHints } from '@/components/learn/KanjiDependencyHints';
import type {
  CurriculumListItem,
  CurriculumParentItem,
} from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type LearnItemRowProps = {
  item: CurriculumListItem;
  testID?: string;
  onPress?: () => void;
  dependencyParents?: CurriculumParentItem[];
  isLocked?: boolean;
  unmetPrerequisites?: CurriculumParentItem[];
};

export function LearnItemRow({
  item,
  testID,
  onPress,
  dependencyParents,
  isLocked,
  unmetPrerequisites,
}: LearnItemRowProps) {
  const isGrammar = item.itemType === 'grammar';
  const isJapaneseForm = item.itemType === 'radical' || item.itemType === 'kanji';

  const content = (
    <>
      <Text
        className={cn(
          isJapaneseForm ? 'text-display text-primary' : 'text-body text-primary',
          isGrammar && 'font-mono',
        )}>
        {item.primaryForm}
      </Text>
      <Text className="mt-1 text-body text-primary">{item.meaning}</Text>

      {isLocked && unmetPrerequisites && unmetPrerequisites.length > 0 ? (
        <KanjiDependencyHints
          parents={unmetPrerequisites}
          mode="unmet"
          testID={testID ? `${testID}-dependencies` : undefined}
        />
      ) : dependencyParents && dependencyParents.length > 0 ? (
        <KanjiDependencyHints
          parents={dependencyParents}
          mode="all"
          testID={testID ? `${testID}-dependencies` : undefined}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.primaryForm}, ${item.meaning}`}
        onPress={onPress}
        testID={testID}
        className={cn('border-b border-border py-4', isLocked && 'opacity-50')}>
        {content}
      </Pressable>
    );
  }

  return (
    <View testID={testID} className="border-b border-border py-4">
      {content}
    </View>
  );
}
