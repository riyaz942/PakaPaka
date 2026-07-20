import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { PASSAGE_CONTENT_ACCENT, PASSAGE_CONTENT_LABEL } from '@/constants/contentType';
import type { BrowsePassageRow } from '@/data/curriculum/browseRepository';
import { cn } from '@/utils/cn';

type PassageBrowseRowProps = {
  row: BrowsePassageRow;
  onPress: () => void;
  testID?: string;
};

/**
 * A reading-passage row in Browse (FR66, UX-DR13–14).
 *
 * Lock here is passage-specific and derived from study coverage — unrelated to
 * the item dependency graph, which Browse never applies to item rows. A locked
 * passage is framed as a destination ("3 to go"), never a bare padlock: the row
 * stays tappable so the learner can see what they are working toward.
 */
function PassageBrowseRowComponent({ row, onPress, testID }: PassageBrowseRowProps) {
  const remainingLabel =
    row.itemsRemainingToUnlock > 0 ? `${row.itemsRemainingToUnlock} to go` : 'Almost there';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        row.locked
          ? `${PASSAGE_CONTENT_LABEL}: ${row.title}. ${remainingLabel} until it opens`
          : `${PASSAGE_CONTENT_LABEL}: ${row.title}`
      }
      onPress={onPress}
      testID={testID}
      className={cn(
        'border-b border-l-4 border-border py-space-md pl-space-md',
        PASSAGE_CONTENT_ACCENT.barLeft,
      )}>
      <View className="flex-row items-center justify-between pr-space-md">
        <Text className={cn('flex-1 text-body-lg', PASSAGE_CONTENT_ACCENT.text)}>{row.title}</Text>
        {row.locked ? (
          <View
            testID={testID ? `${testID}-lock` : undefined}
            className={cn('rounded-radius-full px-space-sm py-[2px]', PASSAGE_CONTENT_ACCENT.tint)}>
            <Text className={cn('text-overline font-semibold', PASSAGE_CONTENT_ACCENT.text)}>
              {remainingLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bilingual one-liner (FR66). `summaryJa` stays null until the Story 3.2
          pipeline compiles summary columns; `summaryEn` falls back to the
          passage's English translation until then. */}
      {row.summaryJa ? (
        <Text numberOfLines={1} className="mt-space-xs text-body text-primary">
          {row.summaryJa}
        </Text>
      ) : null}
      {row.summaryEn ? (
        <Text numberOfLines={1} className="mt-space-xs text-body-sm text-secondary">
          {row.summaryEn}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const PassageBrowseRow = React.memo(PassageBrowseRowComponent);
