import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

import type { AtRiskListItem } from '@/data/hooks/useAtRiskItems';

type AtRiskSectionProps = {
  totalCount: number;
  topItems: AtRiskListItem[];
  allItems: AtRiskListItem[];
  onStartRevision: () => void;
};

function AtRiskRow({ item }: { item: AtRiskListItem }) {
  return (
    <View className="flex-row items-baseline gap-space-sm py-space-xs">
      <Text className="text-body-lg text-primary">{item.primaryForm}</Text>
      <Text className="flex-1 text-body-sm text-secondary" numberOfLines={1}>
        {item.meaning}
      </Text>
    </View>
  );
}

/**
 * FR59 at-risk refresher — invitation framing only, never "items you keep
 * failing". Callers must not render this when totalCount is 0.
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
      className="rounded-radius-lg border border-border bg-surface p-space-md">
      <Text className="text-body font-semibold text-primary">
        {`${totalCount} ${totalCount === 1 ? 'item' : 'items'} ready for a refresher`}
      </Text>
      <Text className="mt-space-xs text-body-sm text-secondary">
        A quick pass now keeps them from slipping.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See all ${totalCount} refresher items`}
        onPress={() => setShowFullList(true)}
        testID="at-risk-open-full-list"
        className="mt-space-sm">
        <View>
          {topItems.map((item) => (
            <AtRiskRow key={item.itemId} item={item} />
          ))}
          {moreCount > 0 ? (
            <Text className="mt-space-xs text-body-sm text-feedback-info">{`+${moreCount} more`}</Text>
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
        <View className="flex-1 bg-background px-space-lg pt-space-xl">
          <Text className="text-title text-primary">Ready for a refresher</Text>
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
