import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { type AccessibilityActionEvent, Pressable, Text, View } from 'react-native';

import { FuriganaText, isWordFuriganaVisible } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
import type { ExampleSentence } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';

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
 * located by the compiled spans shipped with the sentence (14.1a) — every
 * occurrence, dictionary form and taught inflection alike, never
 * auto-segmented at runtime.
 */
export function ExampleSentencesSection({
  sentences,
  testIDPrefix,
}: ExampleSentencesSectionProps) {
  const { mode: furiganaMode, knownKanji, modeForItem, setOverride } = useFuriganaPreference();
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
              setOverride={setOverride}
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
  setOverride,
  hrefFor,
  testIDPrefix,
}: {
  sentence: ExampleSentence;
  furiganaMode: ReturnType<typeof useFuriganaPreference>['mode'];
  knownKanji: ReturnType<typeof useFuriganaPreference>['knownKanji'];
  modeForItem: ReturnType<typeof useFuriganaPreference>['modeForItem'];
  setOverride: ReturnType<typeof useFuriganaPreference>['setOverride'];
  hrefFor: (itemId: string) => string;
  testIDPrefix: string;
}) {
  const { userDb } = useDatabase();
  const parts = useMemo(
    () => buildPassageBodyParts(sentence.japanese, sentence.furigana, sentence.spans),
    [sentence.japanese, sentence.furigana, sentence.spans],
  );

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
        // A linked span *is* one vocabulary item, so its own mastery is the
        // whole answer (Tier 1) rather than a per-kanji check (Tier 2) — the
        // same distinction the word's own hero already uses (FR78 / BUG6).
        const isKnownWord = isVocabularyItemKnown(userDb, vocabularyItemId);
        const handlePress = (): void => {
          const pathname = hrefFor(vocabularyItemId);
          // A conjugated span opens the *base* word, so the detail screen is
          // told which surface sent the learner there (14.1).
          if (part.inflection) {
            router.push({
              pathname,
              params: { surface: part.surface, inflection: part.inflection },
            } as Href);
            return;
          }
          router.push(pathname as Href);
        };
        const handleToggleFurigana = (): void => {
          const visible = isWordFuriganaVisible(
            part.text,
            modeForItem(vocabularyItemId),
            knownKanji,
            isKnownWord,
          );
          setOverride(vocabularyItemId, visible ? 'hidden' : 'shown');
        };
        const handleAccessibilityAction = (event: AccessibilityActionEvent): void => {
          if (event.nativeEvent.actionName === 'toggleFurigana') {
            handleToggleFurigana();
            return;
          }
          handlePress();
        };

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${part.surface}, show word details`}
            accessibilityActions={[
              { name: 'activate', label: 'Show word details' },
              { name: 'toggleFurigana', label: 'Toggle furigana' },
            ]}
            onAccessibilityAction={handleAccessibilityAction}
            onPress={handlePress}
            onLongPress={handleToggleFurigana}
            testID={`${testIDPrefix}-word-${vocabularyItemId}-${index}`}>
            <FuriganaText
              text={part.text}
              // A linked span *is* one vocabulary item, so its per-word
              // override applies here just as it does on the word's own hero.
              mode={modeForItem(vocabularyItemId)}
              knownKanji={knownKanji}
              isKnownWord={isKnownWord}
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
