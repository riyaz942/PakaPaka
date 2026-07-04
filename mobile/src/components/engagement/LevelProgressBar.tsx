import { Text, View } from 'react-native';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';

type ProgressType = 'kanji' | 'vocabulary' | 'grammar';

type TypeProgress = {
  started: number;
  total: number;
};

type LevelProgressBarProps = {
  level: JLPTLevel;
  perType: Record<ProgressType, TypeProgress>;
  overallPercent: number;
};

const TYPE_LABELS: Record<ProgressType, { short: string; dot: string }> = {
  kanji: { short: 'Kanji', dot: 'bg-content-kanji' },
  vocabulary: { short: 'Vocab', dot: 'bg-content-vocabulary' },
  grammar: { short: 'Grammar', dot: 'bg-content-grammar' },
};

function accessibilitySummary(level: JLPTLevel, perType: Record<ProgressType, TypeProgress>, overallPercent: number): string {
  const parts = (['kanji', 'vocabulary', 'grammar'] as ProgressType[]).map(
    (type) => `${TYPE_LABELS[type].short} ${perType[type].started} of ${perType[type].total}`,
  );
  return `${level} progress ${overallPercent} percent. ${parts.join(', ')}`;
}

export function LevelProgressBar({ level, perType, overallPercent }: LevelProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, overallPercent));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilitySummary(level, perType, clamped)}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      className="rounded-radius-lg bg-surface p-space-md">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-body-lg font-semibold text-primary">{`${level} Progress`}</Text>
        <Text className="text-body-sm font-semibold text-feedback-info">{`${clamped}%`}</Text>
      </View>

      <View className="mt-space-sm h-2.5 overflow-hidden rounded-radius-full bg-surface-elevated">
        <View
          className="h-full rounded-radius-full bg-feedback-info"
          style={{ width: `${clamped}%` }}
        />
      </View>

      <View className="mt-space-md flex-row flex-wrap gap-x-space-md gap-y-space-sm">
        {(['kanji', 'grammar', 'vocabulary'] as ProgressType[]).map((type) => (
          <View
            key={type}
            accessibilityRole="text"
            accessibilityLabel={`${TYPE_LABELS[type].short}: ${perType[type].started} of ${perType[type].total}`}
            className="flex-row items-center gap-space-xs">
            <View className={`h-2 w-2 rounded-radius-full ${TYPE_LABELS[type].dot}`} />
            <Text className="text-body-sm text-secondary">
              {`${TYPE_LABELS[type].short} ${perType[type].started}/${perType[type].total}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
