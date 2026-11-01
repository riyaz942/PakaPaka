import React from 'react';
import { Text, View } from 'react-native';

import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { SRSStagePill } from '@/components/common/SRSStageIndicator';
import { useItemHeaderMeta } from '@/data/hooks/useItemHeaderMeta';

/**
 * What the detail header bar carries next to the back arrow: the item's type
 * badge and JLPT level on the left, its SRS stage on the right.
 *
 * All are absent until the item resolves, and the stage pill stays absent for
 * an item that has never been taught — an item with no SRS row has no stage to
 * name, and "not started" belongs in the study-status banner, not the chrome.
 */
export function ItemDetailHeaderBar({ itemId }: { itemId: string | null }) {
  const { itemType, jlptLevel, srsStage } = useItemHeaderMeta(itemId);

  return (
    <>
      {itemType ? <ContentTypeBadge itemType={itemType} testID="item-detail-type-badge" /> : null}
      {jlptLevel ? (
        <View
          testID="item-detail-jlpt-badge"
          accessibilityLabel={`JLPT ${jlptLevel}`}
          className="ml-space-sm self-start rounded-radius-full bg-surface-elevated px-space-sm py-[3px]">
          <Text className="text-overline font-ui-bold tracking-[0.08em] text-secondary">
            {jlptLevel}
          </Text>
        </View>
      ) : null}
      <View className="flex-1" />
      {srsStage ? <SRSStagePill stage={srsStage} testID="item-detail-stage-pill" /> : null}
    </>
  );
}
