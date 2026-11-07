import { Text, View } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { ProgressFill } from '@/components/common/ProgressFill';

import type { ReadingReadinessTarget } from '@/data/hooks/useReadingReadiness';

type ReadingReadinessProps = {
  target: ReadingReadinessTarget;
  onPress: () => void;
};

/**
 * Reading readiness (FR60): frames locked passages as a destination the
 * learner is approaching — never a dead end or a shame wall.
 *
 * The card wears the passage slate: a `content-passage-soft` fill with every
 * line in `content-passage-deep`, the only step of the hue that carries copy.
 */
export function ReadingReadiness({ target, onPress }: ReadingReadinessProps) {
  const headline = target.noProgressYet
    ? 'Your first passage unlocks as you learn'
    : `${target.title} is ${target.itemsRemainingToUnlock} ${
        target.itemsRemainingToUnlock === 1 ? 'item' : 'items'
      } away`;
  const subtitle = target.noProgressYet
    ? 'Start a lesson — reading opens up from what you study.'
    : 'Get these to Guru and the passage opens up.';
  const coveragePercent = Math.min(100, Math.max(0, Math.round(target.coverage * 100)));

  return (
    <PressableScale
      focusable
      accessibilityRole="button"
      accessibilityLabel={`Reading readiness: ${headline}`}
      onPress={onPress}
      testID="reading-readiness"
      className="rounded-radius-lg bg-content-passage-soft p-space-md">
      <Text className="text-overline font-ui-bold uppercase tracking-[0.14em] text-content-passage-deep">
        Reading
      </Text>
      <Text className="mt-space-sm text-body-lg font-ui-extrabold text-content-passage-deep">
        {headline}
      </Text>
      <Text className="mt-space-xs text-body-sm font-ui-medium text-content-passage-deep">
        {subtitle}
      </Text>

      {/* The card has no plain surface to sit a bar on, so the track is the
          passage hue itself held back to a tint. */}
      <View className="mt-space-sm h-[7px] overflow-hidden rounded-radius-full bg-content-passage/20">
        <ProgressFill
          testID="reading-readiness-progress"
          percent={coveragePercent}
          className="h-full rounded-radius-full bg-content-passage"
        />
      </View>
    </PressableScale>
  );
}
