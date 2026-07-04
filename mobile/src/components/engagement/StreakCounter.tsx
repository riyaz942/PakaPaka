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
      className="flex-row items-center gap-space-md rounded-radius-lg bg-surface p-space-md">
      <View className="h-12 w-12 items-center justify-center rounded-radius-full bg-surface-elevated">
        <Text className="text-title">{isBroken ? '🌱' : '🔥'}</Text>
      </View>
      {isBroken ? (
        <View className="flex-1">
          <Text className="text-title-lg text-primary">0</Text>
          <Text className="text-body-sm text-secondary">Start a new streak today!</Text>
        </View>
      ) : (
        <View className="flex-1">
          <Text className="text-title-lg text-primary">{displayCount}</Text>
          <Text className="text-body-sm text-secondary">Current streak</Text>
          {streakState === 'at-risk' ? (
            <Text className="mt-space-xs text-body-sm text-feedback-warning">
              Review today to keep it!
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
