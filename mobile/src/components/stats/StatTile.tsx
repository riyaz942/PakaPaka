import React from 'react';
import { Text, View } from 'react-native';

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
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="flex-1 rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <View className="flex-row items-center gap-space-sm">
        {icon}
        <Text className="text-title-lg font-ui-extrabold text-primary">{value}</Text>
      </View>
      <Text className="mt-space-sm text-caption font-ui-bold text-secondary">{label}</Text>
      <Text className="mt-[2px] text-caption font-ui-medium text-muted">{caption}</Text>
    </View>
  );
}
