import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import type { DomainCounts } from '@/utils/timeFormat';

type SessionSummaryCardProps = {
  domainCounts: DomainCounts;
  actualMinutes: number;
  /** Multi-app estimate (FR33b) — pass only when it beats actualMinutes. */
  estimatedMinutes?: number | null;
  /** Today's goal ring percent (unclamped) for goal-met / overshoot state. */
  goalPercent?: number | null;
  onShare?: () => void;
  sessionDate?: Date;
};

export function goalStateLine(goalPercent: number): string {
  if (goalPercent >= 100) {
    const overshoot = Math.round(goalPercent) - 100;
    return overshoot > 0 ? `Goal met — +${overshoot}% overshoot` : 'Goal met';
  }
  return `${Math.round(goalPercent)}% of today's goal`;
}

function formatSessionDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function SessionSummaryCard({
  domainCounts,
  actualMinutes,
  estimatedMinutes = null,
  goalPercent = null,
  onShare,
  sessionDate = new Date(),
}: SessionSummaryCardProps) {
  return (
    <View className="gap-space-md">
      <Text className="text-title text-primary">Session Summary</Text>
      <Text className="text-body text-secondary">{formatSessionDate(sessionDate)}</Text>

      {estimatedMinutes !== null ? (
        <View testID="time-compression-block">
          <Text
            accessibilityRole="text"
            accessibilityLabel={`${actualMinutes} minutes here versus an estimated ${estimatedMinutes} minutes across separate apps`}
            className="text-title-lg font-semibold text-primary">
            {`${actualMinutes} min here — ~${estimatedMinutes} min in separate apps`}
          </Text>
          <Text className="mt-space-xs text-caption text-secondary">
            Estimated from separate single-purpose apps — deliberately conservative.
          </Text>
        </View>
      ) : null}

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
        accessibilityLabel={`${actualMinutes} minutes studied this session`}
        className="text-body-lg text-primary">
        {`${actualMinutes} min studied`}
      </Text>

      {goalPercent !== null ? (
        <Text
          accessibilityRole="text"
          accessibilityLabel={`Daily goal state: ${goalStateLine(goalPercent)}`}
          className="text-body text-feedback-info"
          testID="session-goal-state">
          {goalStateLine(goalPercent)}
        </Text>
      ) : null}

      {onShare ? (
        <Button label="Share" onPress={onShare} variant="secondary" accessibilityLabel="Share session summary" />
      ) : null}
    </View>
  );
}
