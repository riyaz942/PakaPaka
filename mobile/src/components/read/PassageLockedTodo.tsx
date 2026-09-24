import React from 'react';
import { Text, View } from 'react-native';

import { ContentListRow } from '@/components/common/ContentListRow';
import { Icon } from '@/components/common/Icon';
import { CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { PassageUnlockStatus } from '@/core/content/passageUnlock';
import type { CurriculumListItem } from '@/data/curriculum/itemRepository';
import type { PassageDetail } from '@/data/curriculum/passageRepository';

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
  const coveragePercent = Math.min(100, Math.max(0, Math.round(unlock.coverage * 100)));

  return (
    <View testID="passage-locked-todo">
      {/* The hero wears the passage slate end to end: every line sits on the
          soft fill in the deep tone, the only step of the hue that carries copy. */}
      <View className="rounded-radius-xl bg-content-passage-soft p-space-md">
        <Text className="text-title-lg font-jp-bold text-content-passage-deep">
          {passage.title}
        </Text>

        {passage.summaryJa ? (
          <Text className="mt-space-sm text-body-sm font-jp-medium text-content-passage-deep">
            {passage.summaryJa}
          </Text>
        ) : null}
        {passage.summaryEn ? (
          <Text className="mt-space-xs text-body-sm font-ui text-content-passage-deep/80">
            {passage.summaryEn}
          </Text>
        ) : null}

        <View className="mt-space-md flex-row items-center gap-space-sm">
          <Icon name="locked" size={17} strokeWidth={2} className="text-content-passage-deep" />
          <View
            testID="passage-locked-remaining"
            className="rounded-radius-full bg-content-grammar-soft px-space-sm py-[6px]">
            <Text className="text-body-sm font-ui-extrabold text-content-grammar-deep">
              {remainingLabel}
            </Text>
          </View>
          <Text className="text-caption font-ui-medium text-content-passage-deep">to Guru</Text>
        </View>

        {/* No plain surface inside the card, so the track is the passage hue
            itself held back to a tint. */}
        <View className="mt-space-sm h-[8px] overflow-hidden rounded-radius-full bg-content-passage/20">
          <View
            testID="passage-locked-progress"
            className="h-full rounded-radius-full bg-content-passage"
            style={{ width: `${coveragePercent}%` }}
          />
        </View>

        <Text className="mt-space-sm text-caption font-ui-medium text-content-passage-deep/85">
          Get these to Guru and this passage opens up.
        </Text>
      </View>

      <Text className="mt-space-lg text-body font-ui-extrabold text-primary">Not at Guru yet</Text>

      <View className="mt-space-sm overflow-hidden rounded-radius-md border border-border">
        {neededItems.map((item) => (
          <ContentListRow
            key={item.id}
            rowType={item.itemType}
            glyph={item.primaryForm}
            title={item.meaning}
            showTypeBadge
            onPress={() => onItemPress(item.id)}
            accessibilityLabel={`${CONTENT_TYPE_LABEL[item.itemType]}: ${item.primaryForm}, ${item.meaning}`}
            testID={`passage-needed-item-${item.id}`}
          />
        ))}
      </View>
    </View>
  );
}
