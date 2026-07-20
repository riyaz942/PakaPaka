import React from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { ExampleSentence } from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';

type ExampleSentencesSectionProps = {
  sentences: ExampleSentence[];
  /** Prefix for per-sentence testIDs, e.g. `kanji-example`. */
  testIDPrefix: string;
};

/**
 * Example sentences, shared by the lesson "Examples & links" section and the
 * details scroll so the rows are authored once. Empty set renders nothing.
 */
export function ExampleSentencesSection({
  sentences,
  testIDPrefix,
}: ExampleSentencesSectionProps) {
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();

  if (sentences.length === 0) {
    return null;
  }

  return (
    <View className="mt-4">
      <SectionHeading label="Examples" />
      {sentences.map((sentence) => (
        <View key={sentence.id} className="mt-2" testID={`${testIDPrefix}-${sentence.id}`}>
          <FuriganaText
            text={sentence.furigana ?? sentence.japanese}
            mode={furiganaMode}
            knownKanji={knownKanji}
            className="text-body text-primary"
          />
          <Text className="mt-1 text-body text-secondary">{sentence.english}</Text>
        </View>
      ))}
    </View>
  );
}
