import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ScreenTitle } from '@/components/common/ScreenTitle';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import { cn } from '@/utils/cn';

import type { AtRiskListItem } from '@/data/hooks/useAtRiskItems';

type AtRiskSectionProps = {
  totalCount: number;
  topItems: AtRiskListItem[];
  allItems: AtRiskListItem[];
  onStartRevision: () => void;
};

/** A slipping item as a glyph chip: the form on a surface tile in its type hue. */
function AtRiskChip({ item }: { item: AtRiskListItem }) {
  return (
    <View className="rounded-radius-sm bg-surface px-space-sm py-space-xs">
      <Text
        accessibilityLabel={`${item.primaryForm}, ${item.meaning}`}
        className={cn('text-body-lg font-jp-bold', CONTENT_TYPE_ACCENT[item.itemType].glyph)}>
        {item.primaryForm}
      </Text>
    </View>
  );
}

function AtRiskRow({ item }: { item: AtRiskListItem }) {
  return (
    <View className="flex-row items-baseline gap-space-sm py-space-xs">
      <Text className={cn('text-body-lg font-jp-bold', CONTENT_TYPE_ACCENT[item.itemType].glyph)}>
        {item.primaryForm}
      </Text>
      <Text className="flex-1 text-body-sm font-ui-medium text-secondary" numberOfLines={1}>
        {item.meaning}
      </Text>
    </View>
  );
}

/**
 * FR59 at-risk refresher — invitation framing only, never "items you keep
 * failing". Callers must not render this when totalCount is 0.
 *
 * The card is `feedback-incorrect-soft` with a target icon: red enough to be
 * noticed, soft enough to read as a heads-up rather than a failure.
 */
export function AtRiskSection({
  totalCount,
  topItems,
  allItems,
  onStartRevision,
}: AtRiskSectionProps) {
  const [showFullList, setShowFullList] = useState(false);
  const moreCount = totalCount - topItems.length;

  return (
    <View
      testID="at-risk-section"
      className="rounded-radius-lg bg-feedback-incorrect-soft p-space-md">
      <View className="flex-row items-center gap-space-sm">
        <Icon name="weakness" size={17} strokeWidth={2} className="text-feedback-incorrect" />
        <Text className="text-overline font-ui-bold uppercase tracking-[0.14em] text-feedback-incorrect-deep">
          At risk
        </Text>
      </View>

      <Text className="mt-space-sm text-body-sm font-ui-semibold text-primary">
        {`${totalCount} ${totalCount === 1 ? 'item is' : 'items are'} slipping — this session will target them first.`}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See all ${totalCount} refresher items`}
        onPress={() => setShowFullList(true)}
        testID="at-risk-open-full-list"
        className="mt-space-sm min-h-[44px] justify-center">
        <View className="flex-row flex-wrap items-center gap-space-sm">
          {topItems.map((item) => (
            <AtRiskChip key={item.itemId} item={item} />
          ))}
          {moreCount > 0 ? (
            <Text className="text-body-sm font-ui-semibold text-feedback-incorrect-deep">
              {`+${moreCount} more`}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View className="mt-space-md">
        <Button
          label="Do a small revision"
          variant="secondary"
          onPress={onStartRevision}
          accessibilityLabel="Start a small revision session with these items"
          testID="at-risk-start-revision"
        />
      </View>

      <Modal
        visible={showFullList}
        animationType="slide"
        onRequestClose={() => setShowFullList(false)}>
        <View className="flex-1 bg-background px-space-lg pt-space-xl shadow-e3">
          <ScreenTitle>Ready for a refresher</ScreenTitle>
          <ScrollView className="mt-space-md" testID="at-risk-full-list">
            {allItems.map((item) => (
              <AtRiskRow key={item.itemId} item={item} />
            ))}
          </ScrollView>
          <View className="gap-space-sm pb-space-lg pt-space-md">
            <Button
              label="Do a small revision"
              onPress={() => {
                setShowFullList(false);
                onStartRevision();
              }}
              accessibilityLabel="Start a small revision session with these items"
            />
            <Button
              label="Close"
              variant="ghost"
              onPress={() => setShowFullList(false)}
              accessibilityLabel="Close the refresher list"
              testID="at-risk-close-full-list"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
