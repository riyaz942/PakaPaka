import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import type { ConfusionCluster } from '@/core/srs/srs.types';
import { cn } from '@/utils/cn';

type Props = {
  cluster: ConfusionCluster;
};

/** Below this the pattern reads as a real gap rather than an occasional slip. */
const DANGER_ACCURACY = 0.5;

/**
 * One weak pattern as a soft-filled row with the target mark. The fill tracks
 * severity — danger under half-right, warning above — so a wobbly pattern is
 * not dressed in the same red as one that is genuinely not landing.
 */
export function WeaknessStatCard({ cluster }: Props) {
  const accuracyPercent = Math.min(100, Math.max(0, Math.round(cluster.accuracy * 100)));
  const attemptLabel = cluster.sampleSize === 1 ? 'attempt' : 'attempts';
  const severe = cluster.accuracy < DANGER_ACCURACY;

  return (
    <View
      accessible
      accessibilityLabel={`${cluster.label}: ${accuracyPercent}% accuracy. ${cluster.copy}. ${cluster.sampleSize} ${attemptLabel}`}
      className={cn(
        'flex-row items-start gap-space-sm rounded-radius-md p-space-md',
        severe ? 'bg-feedback-incorrect-soft' : 'bg-feedback-warning-soft',
      )}>
      <Icon
        name="weakness"
        size={16}
        strokeWidth={2}
        className={cn(
          'mt-[3px]',
          severe ? 'text-feedback-incorrect' : 'text-feedback-warning',
        )}
      />
      <View className="flex-1">
        <Text className="text-body-sm font-ui-bold text-primary">{cluster.label}</Text>
        <Text className="mt-space-xs text-caption font-ui-medium text-secondary">
          {cluster.copy}
        </Text>
        <View className="mt-space-sm flex-row items-baseline justify-between">
          <Text
            className={cn(
              'text-caption font-ui-bold',
              severe ? 'text-feedback-incorrect-deep' : 'text-feedback-warning-deep',
            )}>
            {accuracyPercent}% accuracy
          </Text>
          <Text className="text-caption font-ui-medium text-muted">
            {cluster.sampleSize} {attemptLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
