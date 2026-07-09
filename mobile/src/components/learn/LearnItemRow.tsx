import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { KanjiDependencyHints } from '@/components/learn/KanjiDependencyHints';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
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
  const accent = CONTENT_TYPE_ACCENT[item.itemType];

  const content = (
    <>
      <Text
        className={cn(
          isJapaneseForm ? 'text-display' : 'text-body',
          accent.text,
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
        className={cn(
          'border-b border-l-4 border-border py-4 pl-space-md',
          accent.barLeft,
          isLocked && 'opacity-50',
        )}>
        {content}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      className={cn(
        'border-b border-l-4 border-border py-4 pl-space-md',
        accent.barLeft,
        isLocked && 'opacity-50',
      )}>
      {content}
    </View>
  );
}
