import React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type BulkMarkPresetCardProps = {
  title: string;
  count: number;
  onMarkAsKnown: () => void;
  testID?: string;
};

export function BulkMarkPresetCard({
  title,
  count,
  onMarkAsKnown,
  testID,
}: BulkMarkPresetCardProps) {
  return (
    <View
      testID={testID}
      className="rounded-radius-md border border-border bg-surface p-4">
      <Text className="text-body font-semibold text-primary">{title}</Text>
      <Text className="mt-1 text-caption text-secondary">
        {count} {count === 1 ? 'item' : 'items'}
      </Text>
      <Button
        label="Mark as known"
        variant="tertiary"
        onPress={onMarkAsKnown}
        className="mt-3 w-full"
        testID={testID ? `${testID}-mark-action` : undefined}
      />
    </View>
  );
}
