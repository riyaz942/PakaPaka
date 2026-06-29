import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import type { DomainCounts } from '@/utils/timeFormat';

type TimeCompressionSummaryProps = {
  domainCounts: DomainCounts;
  actualMinutes: number;
  estimatedMinutes: number;
  savedMinutes: number;
  hasSavings: boolean;
  onShare?: () => void;
  sessionDate?: Date;
};

const METHODOLOGY_TEXT =
  'Estimated from typical per-item review times in separate single-purpose apps, plus time lost switching between them. Deliberately conservative.';

function formatSessionDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function TimeCompressionSummary({
  domainCounts,
  actualMinutes,
  estimatedMinutes,
  savedMinutes,
  hasSavings,
  onShare,
  sessionDate = new Date(),
}: TimeCompressionSummaryProps) {
  const [methodologyVisible, setMethodologyVisible] = useState(false);

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

      {hasSavings ? (
        <Text
          accessibilityRole="text"
          accessibilityLabel={`${actualMinutes} minutes studied, approximately ${estimatedMinutes} minutes across separate apps, saving about ${savedMinutes} minutes`}
          className="text-body text-primary">
          {`${actualMinutes} min ≈ ~${estimatedMinutes} min across separate apps`}
        </Text>
      ) : (
        <Text
          accessibilityRole="text"
          accessibilityLabel={`Nice focused session, ${actualMinutes} minutes`}
          className="text-body text-secondary">
          {`Nice focused session — ${actualMinutes} min`}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="How is this calculated?"
        onPress={() => setMethodologyVisible((visible) => !visible)}
        className="self-start">
        <Text className="text-body-sm text-feedback-info">How is this calculated?</Text>
      </Pressable>

      {methodologyVisible ? (
        <Text className="text-body-sm text-secondary">{METHODOLOGY_TEXT}</Text>
      ) : null}

      {onShare ? (
        <Button label="Share" onPress={onShare} variant="secondary" accessibilityLabel="Share session summary" />
      ) : null}
    </View>
  );
}

export { METHODOLOGY_TEXT };
