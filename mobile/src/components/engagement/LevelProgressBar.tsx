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

const TYPE_LABELS: Record<ProgressType, { short: string; accent: string }> = {
  kanji: { short: 'Kanji', accent: 'text-content-kanji' },
  vocabulary: { short: 'Vocab', accent: 'text-content-vocabulary' },
  grammar: { short: 'Grammar', accent: 'text-content-grammar' },
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
      className="rounded-radius-md bg-surface p-space-md">
      <Text className="text-body-lg font-semibold text-primary">{`${level} Progress`}</Text>

      <View className="mt-space-sm h-2 overflow-hidden rounded-radius-sm bg-surface-elevated">
        <View
          className="h-full bg-feedback-info"
          style={{ width: `${clamped}%` }}
        />
      </View>

      <View className="mt-space-sm flex-row flex-wrap gap-space-md">
        {(['kanji', 'grammar', 'vocabulary'] as ProgressType[]).map((type) => (
          <Text
            key={type}
            accessibilityRole="text"
            accessibilityLabel={`${TYPE_LABELS[type].short}: ${perType[type].started} of ${perType[type].total}`}
            className={`text-body-sm ${TYPE_LABELS[type].accent}`}>
            {`${TYPE_LABELS[type].short} ${perType[type].started}/${perType[type].total}`}
          </Text>
        ))}
      </View>
    </View>
  );
}
