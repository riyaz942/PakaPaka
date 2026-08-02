import { Text, View } from 'react-native';

import { CONTENT_TYPE_ACCENT, CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';
import { formatMinutes } from '@/utils/timeFormat';

/** Same order and short labels the review summary's count tiles use. */
const TILE_ORDER: ItemType[] = ['kanji', 'vocabulary', 'grammar', 'radical'];
const TILE_LABEL: Record<ItemType, string> = {
  kanji: 'Kanji',
  vocabulary: 'Vocab',
  grammar: 'Grammar',
  radical: 'Radical',
};

type ShadowModeComparisonProps = {
  domainCounts: Record<ItemType, number>;
  itemsReviewed: number;
  correctCount: number;
  durationMs: number;
};

/**
 * Parallel-tool comparison block for the post-session summary (Epic 8, FR33j-PM).
 * Purely a presentation of already-computed session data — never touches the review
 * queue, FSRS scheduling, or due counts.
 */
export function ShadowModeComparison({
  domainCounts,
  itemsReviewed,
  correctCount,
  durationMs,
}: ShadowModeComparisonProps) {
  if (itemsReviewed === 0) {
    return null;
  }

  const retentionPercent = Math.round((100 * correctCount) / itemsReviewed);
  const totalMinutes = formatMinutes(durationMs);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Shadow mode — compare your session"
      className="gap-space-md rounded-radius-lg border border-border bg-surface p-space-md">
      <Text
        accessibilityRole="header"
        className="text-overline font-ui-bold uppercase tracking-[0.08em] text-faint">
        Shadow mode — compare your session
      </Text>

      <Text
        accessibilityRole="text"
        accessibilityLabel={`Retention rate: ${retentionPercent} percent, ${correctCount} of ${itemsReviewed} correct`}
        className="text-title font-ui-extrabold text-primary">
        {`Retention: ${retentionPercent}%`}
      </Text>

      <View className="flex-row gap-space-sm">
        {TILE_ORDER.filter((itemType) => domainCounts[itemType] > 0).map((itemType) => {
          const accent = CONTENT_TYPE_ACCENT[itemType];
          return (
            <View
              key={itemType}
              accessible
              accessibilityLabel={`${CONTENT_TYPE_LABEL[itemType]}: ${domainCounts[itemType]} items reviewed`}
              className={cn('flex-1 items-center rounded-radius-md p-space-sm', accent.soft)}>
              <Text className={cn('text-title font-ui-extrabold', accent.deep)}>
                {domainCounts[itemType]}
              </Text>
              <Text className={cn('text-caption font-ui-semibold', accent.deep)}>
                {TILE_LABEL[itemType]}
              </Text>
            </View>
          );
        })}
      </View>

      <Text
        accessibilityRole="text"
        accessibilityLabel={`${totalMinutes} minutes studied this session`}
        className="text-body font-ui text-primary">
        {`${totalMinutes} min this session`}
      </Text>

      <Text className="text-body-sm font-ui text-muted">
        Compare these with your WaniKani/Bunpro session to see the difference.
      </Text>
    </View>
  );
}
