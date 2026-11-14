import React from 'react';
import { Text, View } from 'react-native';

import { useCountUp } from '@/hooks/useCountUp';

type StatTileProps = {
  /** The number itself — the largest thing on the tile. */
  value: number | string;
  label: string;
  caption: string;
  /** Optional drawn mark shown beside the value. */
  icon?: React.ReactNode;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * A headline stat as one of Stats' two-up cards: big value, label, quiet
 * caption. The pair sits in a `flex-row`, so the tile fills whatever width its
 * parent gives it.
 */
export function StatTile({
  value,
  label,
  caption,
  icon,
  accessibilityLabel,
  testID,
}: StatTileProps) {
  // Numbers count up when the tile appears; text values show as they are.
  const counted = useCountUp(typeof value === 'number' ? value : 0);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="flex-1 rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <View className="flex-row items-center gap-space-sm">
        {icon}
        <Text className="text-title-lg font-ui-extrabold text-primary">{typeof value === 'number' ? counted : value}</Text>
      </View>
      <Text className="mt-space-sm text-caption font-ui-bold text-secondary">{label}</Text>
      <Text className="mt-[2px] text-caption font-ui-medium text-muted">{caption}</Text>
    </View>
  );
}
