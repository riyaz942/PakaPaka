import { Text, View } from 'react-native';

import type { StreakState } from '@/data/user/streakRepository';

type StreakCounterProps = {
  currentStreak: number;
  streakState: StreakState;
  longestStreak?: number;
  testID?: string;
};

function accessibilityLabelFor(displayCount: number, streakState: StreakState): string {
  if (streakState === 'broken') {
    return `Streak broken: ${displayCount} days. Start a new streak today!`;
  }
  if (streakState === 'at-risk') {
    return `Current streak: ${displayCount} days. Review today to keep it!`;
  }
  return `Current streak: ${displayCount} days`;
}

export function StreakCounter({
  currentStreak,
  streakState,
  testID,
}: StreakCounterProps) {
  const isBroken = streakState === 'broken';
  const displayCount = isBroken ? 0 : currentStreak;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabelFor(displayCount, streakState)}
      testID={testID}
      className="rounded-radius-md bg-surface p-4">
      {isBroken ? (
        <>
          <Text className="text-title font-semibold text-primary">0</Text>
          <Text className="mt-1 text-body text-secondary">Start a new streak today!</Text>
        </>
      ) : (
        <>
          <Text className="text-title font-semibold text-primary">
            {`🔥 ${displayCount}`}
          </Text>
          <Text className="mt-1 text-body text-secondary">Current streak</Text>
          {streakState === 'at-risk' ? (
            <Text className="mt-1 text-body-sm text-secondary">Review today to keep it!</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
