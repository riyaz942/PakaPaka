import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SRSStageIndicator } from '@/components/common/SRSStageIndicator';
import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { BrowseItemRow } from '@/data/curriculum/browseRepository';
import { cn } from '@/utils/cn';

type BrowseRowProps = {
  row: BrowseItemRow;
  onPress: () => void;
  testID?: string;
};

/**
 * A radical / kanji / vocabulary / grammar row in Browse.
 *
 * **BUG7 fix:** this component takes no lock, prerequisite or dependency prop,
 * and there is nowhere to pass one. Browse is discovery — every item is
 * viewable regardless of lesson eligibility (FR67). Dependency-graph gating
 * still governs the *lesson planner*, which is a different question from
 * whether the learner may look something up.
 */
function BrowseRowComponent({ row, onPress, testID }: BrowseRowProps) {
  const accent = CONTENT_TYPE_ACCENT[row.itemType];
  const isJapaneseForm = row.itemType === 'radical' || row.itemType === 'kanji';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${CONTENT_TYPE_LABEL[row.itemType]}: ${row.primaryForm}, ${row.meaning}`}
      onPress={onPress}
      testID={testID}
      className={cn('border-b border-l-4 border-border py-space-md pl-space-md', accent.barLeft)}>
      <View className="flex-row items-center justify-between pr-space-md">
        <Text
          className={cn(
            isJapaneseForm ? 'text-display' : 'text-body-lg',
            accent.text,
            row.itemType === 'grammar' && 'font-mono',
          )}>
          {row.primaryForm}
        </Text>
        {row.srsStage ? <SRSStageIndicator stage={row.srsStage} /> : null}
      </View>
      <Text className="mt-space-xs text-body text-primary">{row.meaning}</Text>
    </Pressable>
  );
}

/**
 * Memoized: Browse renders long virtualized lists and re-renders on every
 * keystroke's debounce tick, so rows must not re-render when their data is
 * unchanged (called out in deferred-work.md).
 */
export const BrowseRow = React.memo(BrowseRowComponent);
