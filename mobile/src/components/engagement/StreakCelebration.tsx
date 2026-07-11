import { useEffect, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type StreakCelebrationProps = {
  streakCount: number;
};

/** Delay before the counter ticks from n-1 to n — lands just after the emblem spring settles. */
const COUNT_UP_DELAY_MS = 500;

/**
 * Once-per-day streak celebration shown on the first completed session
 * (lesson or review). Gate rendering with useStreakCelebration — this
 * component always plays when mounted.
 */
export function StreakCelebration({ streakCount }: StreakCelebrationProps) {
  const { reducedMotion } = useReducedMotion();
  const [displayCount, setDisplayCount] = useState(() =>
    reducedMotion ? streakCount : Math.max(0, streakCount - 1),
  );

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${streakCount} day streak`);
  }, [streakCount]);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayCount(streakCount);
      return;
    }
    const timer = setTimeout(() => setDisplayCount(streakCount), COUNT_UP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion, streakCount]);

  const emblem = (
    <View className="h-24 w-24 items-center justify-center rounded-radius-full bg-feedback-warning/15">
      <Text className="text-display">🔥</Text>
    </View>
  );

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${streakCount} day streak`}
      testID="streak-celebration"
      className="items-center gap-space-sm">
      {reducedMotion ? (
        emblem
      ) : (
        <Animated.View entering={ZoomIn.springify().damping(12)}>{emblem}</Animated.View>
      )}
      <Text className="text-title-lg text-primary" testID="streak-celebration-count">
        {`${displayCount} day streak`}
      </Text>
    </View>
  );
}
