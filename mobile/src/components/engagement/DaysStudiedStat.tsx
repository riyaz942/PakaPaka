import { Text, View } from 'react-native';

type DaysStudiedStatProps = {
  daysStudied: number;
};

/**
 * Calm monthly activity (UX-DR20): a plain count, deliberately not a streak —
 * no flame, no at-risk state, zero shown without drama.
 */
export function DaysStudiedStat({ daysStudied }: DaysStudiedStatProps) {
  return (
    <View
      testID="days-studied-stat"
      accessibilityLabel={`${daysStudied} days studied this month`}
      className="rounded-radius-lg border border-border bg-surface p-space-md">
      <Text className="text-display text-primary">{daysStudied}</Text>
      <Text className="mt-space-xs text-body font-semibold text-primary">
        Days studied this month
      </Text>
      <Text className="mt-space-xs text-body-sm text-secondary">
        Calm activity — not a streak
      </Text>
    </View>
  );
}
