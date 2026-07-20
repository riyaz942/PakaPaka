import { Text, View } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';

import type { ReadingReadinessTarget } from '@/data/hooks/useReadingReadiness';

type ReadingReadinessProps = {
  target: ReadingReadinessTarget;
  onPress: () => void;
};

/**
 * Reading readiness (FR60): frames locked passages as a destination the
 * learner is approaching — never a dead end or a shame wall.
 */
export function ReadingReadiness({ target, onPress }: ReadingReadinessProps) {
  const headline = target.noProgressYet
    ? 'Your first passage unlocks as you learn'
    : `${target.itemsRemainingToUnlock} ${
        target.itemsRemainingToUnlock === 1 ? 'item' : 'items'
      } from unlocking “${target.title}”`;
  const subtitle = target.noProgressYet
    ? 'Start a lesson — reading opens up from what you study.'
    : 'Keep reviewing — this passage opens when the words stick.';

  return (
    <PressableScale
      focusable
      accessibilityRole="button"
      accessibilityLabel={`Reading readiness: ${headline}`}
      onPress={onPress}
      testID="reading-readiness"
      className="rounded-radius-lg border border-border bg-surface p-space-md">
      <Text className="text-overline text-content-vocabulary">READING</Text>
      <View className="mt-space-xs">
        <Text className="text-body font-semibold text-primary">{headline}</Text>
        <Text className="mt-space-xs text-body-sm text-secondary">{subtitle}</Text>
      </View>
    </PressableScale>
  );
}
