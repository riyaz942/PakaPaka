import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { buildExampleSentenceSpans } from '@/core/content/exampleSentenceSpans';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
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
 *
 * Linked vocabulary (Plan 11.6) is pressable via tap and long-press (NFR29),
 * located by the first `primary_form` match — never auto-segmented.
 */
export function ExampleSentencesSection({
  sentences,
  testIDPrefix,
}: ExampleSentencesSectionProps) {
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const hrefFor = useItemHref();

  if (sentences.length === 0) {
    return null;
  }

  return (
    <View className="mt-4">
      <SectionHeading label="Examples" />
      {sentences.map((sentence) => (
        <View key={sentence.id} className="mt-2" testID={`${testIDPrefix}-${sentence.id}`}>
          <ExampleSentenceJapanese
            sentence={sentence}
            furiganaMode={furiganaMode}
            knownKanji={knownKanji}
            hrefFor={hrefFor}
            testIDPrefix={testIDPrefix}
          />
          <Text className="mt-1 text-body text-secondary">{sentence.english}</Text>
        </View>
      ))}
    </View>
  );
}

function ExampleSentenceJapanese({
  sentence,
  furiganaMode,
  knownKanji,
  hrefFor,
  testIDPrefix,
}: {
  sentence: ExampleSentence;
  furiganaMode: ReturnType<typeof useFuriganaPreference>['mode'];
  knownKanji: ReturnType<typeof useFuriganaPreference>['knownKanji'];
  hrefFor: (itemId: string) => string;
  testIDPrefix: string;
}) {
  const parts = useMemo(() => {
    const spans = buildExampleSentenceSpans(sentence.japanese, sentence.vocabularyLinks);
    return buildPassageBodyParts(sentence.japanese, sentence.furigana, spans);
  }, [sentence.japanese, sentence.furigana, sentence.vocabularyLinks]);

  const hasLinks = parts.some((part) => part.vocabularyItemId !== null);

  if (!hasLinks) {
    return (
      <FuriganaText
        text={sentence.furigana ?? sentence.japanese}
        mode={furiganaMode}
        knownKanji={knownKanji}
        className="text-body text-primary"
      />
    );
  }

  return (
    <View
      className="flex-row flex-wrap items-end"
      testID={`${testIDPrefix}-${sentence.id}-linked`}>
      {parts.map((part, index) => {
        const key = `${index}-${part.surface}`;

        if (part.vocabularyItemId === null) {
          return (
            <FuriganaText
              key={key}
              text={part.text}
              mode={furiganaMode}
              knownKanji={knownKanji}
              className="text-body text-primary"
            />
          );
        }

        const vocabularyItemId = part.vocabularyItemId;
        const handlePress = (): void => {
          router.push(hrefFor(vocabularyItemId) as Href);
        };

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${part.surface}, show word details`}
            accessibilityActions={[{ name: 'activate', label: 'Show word details' }]}
            onAccessibilityAction={handlePress}
            onPress={handlePress}
            onLongPress={handlePress}
            testID={`${testIDPrefix}-word-${vocabularyItemId}-${index}`}>
            <FuriganaText
              text={part.text}
              mode={furiganaMode}
              knownKanji={knownKanji}
              // Nested furigana toggles would steal the span tap (NFR29).
              interactive={false}
              className="text-body text-content-vocabulary underline"
            />
          </Pressable>
        );
      })}
    </View>
  );
}
