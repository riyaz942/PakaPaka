import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ITEM_TYPE_LABELS } from '@/data/curriculum/itemRepository';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import type { CategoryProgress } from '@/data/hooks/levelProgressShared';
import type { LevelProgressCategory } from '@/data/hooks/useAllLevelsProgress';

type LevelOverviewCardProps = {
  level: JLPTLevel;
  perCategory: Record<LevelProgressCategory, CategoryProgress>;
  overallPercent: number;
  isActive: boolean;
  hasFullContent: boolean;
  onSetActive: (level: JLPTLevel) => void;
  testID?: string;
};

const CATEGORY_ORDER: LevelProgressCategory[] = ['radical', 'kanji', 'vocabulary', 'grammar', 'passage'];

const CATEGORY_LABELS: Record<LevelProgressCategory, string> = {
  ...ITEM_TYPE_LABELS,
  passage: 'Passages',
};

const CATEGORY_DOTS: Record<LevelProgressCategory, string> = {
  radical: 'bg-content-radical',
  kanji: 'bg-content-kanji',
  vocabulary: 'bg-content-vocabulary',
  grammar: 'bg-content-grammar',
  passage: 'bg-content-passage',
};

const CONTENT_ONLY_CATEGORIES: LevelProgressCategory[] = ['grammar', 'passage'];

function accessibilitySummary(
  level: JLPTLevel,
  perCategory: Record<LevelProgressCategory, CategoryProgress>,
  overallPercent: number,
  hasFullContent: boolean,
): string {
  const parts = CATEGORY_ORDER.map((category) => {
    if (!hasFullContent && CONTENT_ONLY_CATEGORIES.includes(category)) {
      return `${CATEGORY_LABELS[category]} not yet available`;
    }
    return `${CATEGORY_LABELS[category]} ${perCategory[category].started} of ${perCategory[category].total}`;
  });
  return `${level} progress ${overallPercent} percent. ${parts.join(', ')}`;
}

export function LevelOverviewCard({
  level,
  perCategory,
  overallPercent,
  isActive,
  hasFullContent,
  onSetActive,
  testID,
}: LevelOverviewCardProps) {
  const clamped = Math.min(100, Math.max(0, overallPercent));

  return (
    <View
      testID={testID}
      className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-space-xs">
          <Text className="text-body font-ui-extrabold text-primary">{level}</Text>
          {isActive ? (
            <View className="rounded-radius-full bg-brand-500 px-space-sm py-[2px]">
              <Text className="text-caption font-ui-bold text-on-primary">Active</Text>
            </View>
          ) : null}
          {!hasFullContent ? (
            <View className="rounded-radius-full bg-surface-elevated px-space-sm py-[2px]">
              <Text className="text-caption font-ui-semibold text-faint">Limited content</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-body-sm font-ui-extrabold text-brand-text">{`${clamped}%`}</Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilitySummary(level, perCategory, clamped, hasFullContent)}
        accessibilityValue={{ min: 0, max: 100, now: clamped }}
        className="mt-space-sm h-2 overflow-hidden rounded-radius-full bg-surface-elevated">
        <View className="h-full rounded-radius-full bg-brand-500" style={{ width: `${clamped}%` }} />
      </View>

      <View className="mt-space-sm gap-y-space-xs">
        {CATEGORY_ORDER.map((category) => {
          const unavailable = !hasFullContent && CONTENT_ONLY_CATEGORIES.includes(category);
          return (
            <View
              key={category}
              accessibilityRole="text"
              accessibilityLabel={
                unavailable
                  ? `${CATEGORY_LABELS[category]}: not yet available`
                  : `${CATEGORY_LABELS[category]}: ${perCategory[category].started} of ${perCategory[category].total}`
              }
              className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-space-xs">
                <View className={`h-[7px] w-[7px] rounded-radius-full ${CATEGORY_DOTS[category]}`} />
                <Text className="text-caption font-ui-semibold text-secondary">
                  {CATEGORY_LABELS[category]}
                </Text>
              </View>
              <Text className="text-caption font-ui-semibold text-muted">
                {unavailable ? 'Not yet available' : `${perCategory[category].started}/${perCategory[category].total}`}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="mt-space-md">
        {isActive ? (
          <View className="flex-row items-center gap-space-xs">
            <Icon name="correct" size={18} strokeWidth={2} className="text-brand-500" />
            <Text className="text-caption font-ui-semibold text-secondary">Active level</Text>
          </View>
        ) : hasFullContent ? (
          <Button
            label="Set as active level"
            variant="secondary"
            onPress={() => onSetActive(level)}
            accessibilityLabel={`Set ${level} as your active level`}
            testID={testID ? `${testID}-set-active` : undefined}
          />
        ) : (
          <Text className="text-caption font-ui-medium text-faint">
            {`Kanji and vocabulary only — grammar and passages aren't available for ${level} yet.`}
          </Text>
        )}
      </View>
    </View>
  );
}
