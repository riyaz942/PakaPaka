import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { buildExampleSentenceSpans } from '@/core/content/exampleSentenceSpans';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
import { getExampleSentences, getItemBySlug } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

/**
 * "Japanese writes no spaces between words", shown rather than asserted: one
 * real authored sentence twice over, first verbatim and then split on its own
 * vocabulary links.
 *
 * The boundaries are the sentence's authored links run through the same
 * segmenter the passage reader uses — never a hand-written split string, which
 * would drift from the content the moment the sentence changed.
 */
export function WordSpacingCard() {
  const { curriculumDb } = useDatabase();

  const sentence = useMemo(() => {
    const grammar = getItemBySlug(curriculumDb, 'grammar', 'wa-topic');
    if (!grammar) {
      return null;
    }
    return getExampleSentences(curriculumDb, grammar.id)[0] ?? null;
  }, [curriculumDb]);

  const parts = useMemo(() => {
    if (!sentence) {
      return [];
    }
    const spans = buildExampleSentenceSpans(sentence.japanese, sentence.vocabularyLinks);
    return buildPassageBodyParts(sentence.japanese, sentence.furigana, spans);
  }, [sentence]);

  return (
    <View className="gap-space-sm" testID="word-spacing-card">
      <Text className="text-body font-ui text-secondary">
        Japanese leaves no spaces between words. Nothing is missing — the scripts themselves show
        you where one word stops and the next begins.
      </Text>

      {sentence ? (
        <>
          <View
            className="gap-space-xs rounded-radius-lg border border-border bg-surface p-space-lg"
            testID="word-spacing-verbatim">
            <Text className="text-body-sm font-ui-bold uppercase text-muted">As it is written</Text>
            <FuriganaText
              text={sentence.furigana ?? sentence.japanese}
              mode="shown"
              className="font-jp text-title text-primary"
            />
          </View>

          <View
            className="gap-space-xs rounded-radius-lg border border-border bg-surface p-space-lg"
            testID="word-spacing-separated">
            <Text className="text-body-sm font-ui-bold uppercase text-muted">
              The same sentence, pulled apart
            </Text>
            <View className="flex-row flex-wrap items-end gap-space-md">
              {parts.map((part, index) => (
                <View key={index} testID={`word-spacing-part-${index}`}>
                  <FuriganaText
                    text={part.text}
                    mode="shown"
                    className="font-jp text-title text-primary"
                  />
                </View>
              ))}
            </View>
            <Text className="text-body-sm font-ui text-muted">{sentence.english}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
