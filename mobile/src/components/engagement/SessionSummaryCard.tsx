import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import type { DomainCounts } from '@/utils/timeFormat';

type SessionSummaryCardProps = {
  domainCounts: DomainCounts;
  actualMinutes: number;
  onShare?: () => void;
  sessionDate?: Date;
};

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
  onShare,
  sessionDate = new Date(),
}: SessionSummaryCardProps) {
  return (
    <View className="gap-space-md">
      <Text className="text-title text-primary">Session Summary</Text>
      <Text className="text-body text-secondary">{formatSessionDate(sessionDate)}</Text>

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

      {onShare ? (
        <Button label="Share" onPress={onShare} variant="secondary" accessibilityLabel="Share session summary" />
      ) : null}
    </View>
  );
}
