import React from 'react';
import { Text, View } from 'react-native';

import { ContentPlaceholderNotice } from '@/components/common/ContentPlaceholderNotice';
import { LinkedSentence } from '@/components/common/LinkedSentence';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { ExampleSentence } from '@/data/curriculum/itemRepository';

type ExampleSentencesSectionProps = {
  sentences: ExampleSentence[];
  /** Prefix for per-sentence testIDs, e.g. `kanji-example`. */
  testIDPrefix: string;
  /**
   * Shown in place of the section when `sentences` is empty. Opt-in: most
   * item types render nothing until examples exist, but vocabulary and
   * grammar detail screens want a "not authored yet" notice instead of
   * silence.
   */
  emptyPlaceholder?: string;
};

/**
 * Example sentences, shared by the lesson "Examples & links" section and the
 * details scroll so the rows are authored once. Empty set renders nothing,
 * unless `emptyPlaceholder` is given.
 *
 * Linked vocabulary (Plan 11.6) is pressable via tap and long-press (NFR29),
 * located by the compiled spans shipped with the sentence (14.1a) — every
 * occurrence, dictionary form and taught inflection alike, never
 * auto-segmented at runtime.
 */
export function ExampleSentencesSection({
  sentences,
  testIDPrefix,
  emptyPlaceholder,
}: ExampleSentencesSectionProps) {
  if (sentences.length === 0) {
    if (!emptyPlaceholder) {
      return null;
    }

    return (
      <View className="mt-space-md">
        <SectionHeading label="Examples" />
        <ContentPlaceholderNotice
          label={emptyPlaceholder}
          testID={`${testIDPrefix}-placeholder`}
        />
      </View>
    );
  }

  return (
    <View className="mt-space-md">
      <SectionHeading label="Examples" />
      <View className="mt-space-sm gap-space-md">
        {sentences.map((sentence) => (
          <View key={sentence.id} testID={`${testIDPrefix}-${sentence.id}`}>
            <LinkedSentence
              japanese={sentence.japanese}
              furigana={sentence.furigana}
              spans={sentence.spans}
              testIDPrefix={testIDPrefix}
              sentenceId={sentence.id}
            />
            <Text className="mt-[3px] text-body-sm font-ui text-muted">{sentence.english}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
