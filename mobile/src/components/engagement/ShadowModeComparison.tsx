import { Text, View } from 'react-native';

import type { ItemType } from '@/data/curriculum/itemRepository';
import { formatMinutes } from '@/utils/timeFormat';

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
      className="gap-space-md rounded-radius-md border border-border bg-surface p-space-md">
      <Text accessibilityRole="header" className="text-title text-primary">
        Shadow mode — compare your session
      </Text>

      <Text
        accessibilityRole="text"
        accessibilityLabel={`Retention rate: ${retentionPercent} percent, ${correctCount} of ${itemsReviewed} correct`}
        className="text-body-lg text-primary">
        {`Retention: ${retentionPercent}%`}
      </Text>

      <View className="flex-row flex-wrap gap-space-md">
        {domainCounts.kanji > 0 ? (
          <Text
            accessibilityRole="text"
            accessibilityLabel={`Kanji: ${domainCounts.kanji} items reviewed`}
            className="text-body text-content-kanji">
            Kanji {domainCounts.kanji}
          </Text>
        ) : null}
        {domainCounts.grammar > 0 ? (
          <Text
            accessibilityRole="text"
            accessibilityLabel={`Grammar: ${domainCounts.grammar} items reviewed`}
            className="text-body text-content-grammar">
            Grammar {domainCounts.grammar}
          </Text>
        ) : null}
        {domainCounts.vocabulary > 0 ? (
          <Text
            accessibilityRole="text"
            accessibilityLabel={`Vocabulary: ${domainCounts.vocabulary} items reviewed`}
            className="text-body text-content-vocabulary">
            Vocab {domainCounts.vocabulary}
          </Text>
        ) : null}
        {domainCounts.radical > 0 ? (
          <Text
            accessibilityRole="text"
            accessibilityLabel={`Radicals: ${domainCounts.radical} items reviewed`}
            className="text-body text-secondary">
            Radical {domainCounts.radical}
          </Text>
        ) : null}
      </View>

      <Text
        accessibilityRole="text"
        accessibilityLabel={`${totalMinutes} minutes studied this session`}
        className="text-body text-primary">
        {`${totalMinutes} min this session`}
      </Text>

      <Text className="text-body-sm text-secondary">
        Compare these with your WaniKani/Bunpro session to see the difference.
      </Text>
    </View>
  );
}
