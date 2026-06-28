import { Text, View } from 'react-native';

import type { ConfusionCluster } from '@/core/srs/srs.types';

type Props = {
  cluster: ConfusionCluster;
};

export function WeaknessStatCard({ cluster }: Props) {
  const accuracyPercent = Math.min(100, Math.max(0, Math.round(cluster.accuracy * 100)));
  const attemptLabel = cluster.sampleSize === 1 ? 'attempt' : 'attempts';

  return (
    <View
      accessible
      accessibilityLabel={`${cluster.label}: ${accuracyPercent}% accuracy. ${cluster.copy}. ${cluster.sampleSize} ${attemptLabel}`}
      className="rounded-radius-md border border-border bg-surface p-space-md">
      <Text className="text-body-lg font-semibold text-primary">{cluster.label}</Text>
      <Text className="mt-space-xs text-body text-secondary">{cluster.copy}</Text>
      <View className="mt-space-sm flex-row items-baseline justify-between">
        <Text className="text-body font-semibold text-feedback-warning">
          {accuracyPercent}% accuracy
        </Text>
        <Text className="text-body-sm text-secondary">
          {cluster.sampleSize} {attemptLabel}
        </Text>
      </View>
    </View>
  );
}
