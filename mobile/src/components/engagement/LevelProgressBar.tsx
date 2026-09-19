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

export function accessibilitySummary(level: JLPTLevel, perType: Record<ProgressType, TypeProgress>, overallPercent: number): string {
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
      className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-body font-ui-extrabold text-primary">{`${level} Progress`}</Text>
        <Text className="text-body-sm font-ui-extrabold text-brand-text">{`${clamped}%`}</Text>
      </View>

      <View className="mt-space-sm h-2 overflow-hidden rounded-radius-full bg-surface-elevated">
        <View
          className="h-full rounded-radius-full bg-brand-500"
          style={{ width: `${clamped}%` }}
        />
      </View>

      <View className="mt-space-sm flex-row flex-wrap gap-x-space-md gap-y-space-xs">
        {(['kanji', 'grammar', 'vocabulary'] as ProgressType[]).map((type) => (
          <View
            key={type}
            accessibilityRole="text"
            accessibilityLabel={`${TYPE_LABELS[type].short}: ${perType[type].started} of ${perType[type].total}`}
            className="flex-row items-center gap-space-xs">
            <View className={`h-[7px] w-[7px] rounded-radius-full ${TYPE_LABELS[type].dot}`} />
            <Text className="text-caption font-ui-semibold text-secondary">
              {`${TYPE_LABELS[type].short} ${perType[type].started}/${perType[type].total}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
