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

/**
 * Example Japanese sits a step above body copy so ruby has room and the kanji
 * stay legible — the spec's 17px rounds to the 18px `body-lg` step.
 */
const EXAMPLE_JAPANESE = 'text-body-lg font-jp-medium text-primary';

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
  const { mode: furiganaMode, knownKanji, modeForItem } = useFuriganaPreference();
  const hrefFor = useItemHref();

  if (sentences.length === 0) {
    return null;
  }

  return (
    <View className="mt-space-md">
      <SectionHeading label="Examples" />
      <View className="mt-space-sm gap-space-md">
        {sentences.map((sentence) => (
          <View key={sentence.id} testID={`${testIDPrefix}-${sentence.id}`}>
            <ExampleSentenceJapanese
              sentence={sentence}
              furiganaMode={furiganaMode}
              knownKanji={knownKanji}
              modeForItem={modeForItem}
              hrefFor={hrefFor}
              testIDPrefix={testIDPrefix}
            />
            <Text className="mt-[3px] text-body-sm font-ui text-muted">{sentence.english}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ExampleSentenceJapanese({
  sentence,
  furiganaMode,
  knownKanji,
  modeForItem,
  hrefFor,
  testIDPrefix,
}: {
  sentence: ExampleSentence;
  furiganaMode: ReturnType<typeof useFuriganaPreference>['mode'];
  knownKanji: ReturnType<typeof useFuriganaPreference>['knownKanji'];
  modeForItem: ReturnType<typeof useFuriganaPreference>['modeForItem'];
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
        className={EXAMPLE_JAPANESE}
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
              className={EXAMPLE_JAPANESE}
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
              // A linked span *is* one vocabulary item, so its per-word
              // override applies here just as it does on the word's own hero.
              mode={modeForItem(vocabularyItemId)}
              knownKanji={knownKanji}
              // Nested furigana toggles would steal the span tap (NFR29).
              interactive={false}
              className="text-body-lg font-jp-medium text-content-vocabulary-deep underline"
            />
          </Pressable>
        );
      })}
    </View>
  );
}
