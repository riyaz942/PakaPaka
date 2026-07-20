import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  CONTENT_TYPE_ACCENT,
  CONTENT_TYPE_LABEL,
  PASSAGE_CONTENT_ACCENT,
} from '@/constants/contentType';
import type { PassageUnlockStatus } from '@/core/content/passageUnlock';
import type { CurriculumListItem } from '@/data/curriculum/itemRepository';
import type { PassageDetail } from '@/data/curriculum/passageRepository';
import { cn } from '@/utils/cn';

type PassageLockedTodoProps = {
  passage: PassageDetail;
  unlock: PassageUnlockStatus;
  neededItems: CurriculumListItem[];
  onItemPress: (itemId: string) => void;
};

/**
 * What a locked passage shows instead of the reader (FR69, UX-DR14).
 *
 * The framing is a destination the learner is walking toward, not a wall: the
 * summary tells them what they are working *for*, and the to-do list names the
 * exact vocab/grammar still below Guru so the next step is always concrete.
 * Comprehension practice is deliberately absent while locked.
 */
export function PassageLockedTodo({
  passage,
  unlock,
  neededItems,
  onItemPress,
}: PassageLockedTodoProps) {
  const remainingLabel =
    unlock.itemsRemainingToUnlock > 0
      ? `${unlock.itemsRemainingToUnlock} to go`
      : 'Almost there';

  return (
    <View testID="passage-locked-todo">
      <Text className="text-title text-primary">{passage.title}</Text>

      {passage.summaryJa ? (
        <Text className="mt-space-sm text-body-lg text-primary">{passage.summaryJa}</Text>
      ) : null}
      {passage.summaryEn ? (
        <Text className="mt-space-xs text-body text-secondary">{passage.summaryEn}</Text>
      ) : null}

      <View
        testID="passage-locked-remaining"
        className={cn(
          'mt-space-lg self-start rounded-radius-full px-space-md py-space-xs',
          PASSAGE_CONTENT_ACCENT.tint,
        )}>
        <Text className={cn('text-body font-semibold', PASSAGE_CONTENT_ACCENT.text)}>
          {remainingLabel}
        </Text>
      </View>

      <Text className="mt-space-sm text-body text-secondary">
        Get these to Guru and this passage opens up.
      </Text>

      <View className="mt-space-lg">
        <Text className="text-body font-semibold text-primary">Still to learn</Text>

        {neededItems.map((item) => {
          const accent = CONTENT_TYPE_ACCENT[item.itemType];
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${CONTENT_TYPE_LABEL[item.itemType]}: ${item.primaryForm}, ${item.meaning}`}
              onPress={() => onItemPress(item.id)}
              testID={`passage-needed-item-${item.id}`}
              className={cn(
                'mt-space-sm min-h-[44px] border-b border-l-4 border-border py-space-md pl-space-md',
                accent.barLeft,
              )}>
              <View className="flex-row items-center justify-between pr-space-md">
                <Text className={cn('flex-1 text-body-lg', accent.text)}>{item.primaryForm}</Text>
                <View className={cn('rounded-radius-full px-space-sm py-[2px]', accent.tint)}>
                  <Text className={cn('text-overline font-semibold', accent.text)}>
                    {CONTENT_TYPE_LABEL[item.itemType]}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={1} className="mt-space-xs text-body-sm text-secondary">
                {item.meaning}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
