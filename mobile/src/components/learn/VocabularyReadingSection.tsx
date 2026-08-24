import React from 'react';
import { Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import { PronunciationButton } from '@/components/learn/PronunciationButton';
import { parseFurigana } from '@/core/furigana/parseFurigana';

type VocabularyReadingSectionProps = {
  /** The word's annotated furigana (`私[わたし]`), or null when it carries none. */
  furigana: string | null;
  /** Surface form to fall back to when there is no furigana, and to speak aloud. */
  primaryForm: string;
};

/** Plain kana reading, independent of any furigana show/hide preference. */
export function plainReading(furigana: string | null, primaryForm: string): string {
  if (!furigana) {
    return primaryForm;
  }
  return parseFurigana(furigana)
    .map((segment) => segment.reading ?? segment.text)
    .join('');
}

/**
 * Always-visible word reading — the vocabulary-page twin of
 * `KanjiReadingsSection`. Unlike the hero `FuriganaText` above it, this does
 * not hide once the word is mastered or the furigana mode is 'hidden': the
 * hero's auto-hide is intentional (FR78), but the learner should always be
 * able to check the reading somewhere on the page, the way kanji details
 * always shows on'yomi/kun'yomi.
 */
export function VocabularyReadingSection({ furigana, primaryForm }: VocabularyReadingSectionProps) {
  const reading = plainReading(furigana, primaryForm);

  return (
    <View
      className="mt-space-md flex-row items-center justify-between rounded-radius-md border border-border bg-surface px-space-md py-space-sm shadow-e1"
      testID="vocabulary-reading">
      <View className="flex-1">
        <SectionHeading label="Reading" />
        <Text className="mt-[5px] text-title font-jp-bold text-primary">{reading}</Text>
      </View>
      <PronunciationButton text={primaryForm} testID="vocabulary-pronunciation-button" />
    </View>
  );
}
