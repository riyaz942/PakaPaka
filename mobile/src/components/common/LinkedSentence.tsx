import { router, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { LinkedWord } from '@/components/common/LinkedWord';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { buildPassageBodyParts } from '@/core/content/passageBodyParts';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';
import { cn } from '@/utils/cn';

type LinkedSentenceProps = {
  japanese: string;
  furigana: string | null;
  spans: PassageWordSpan[];
  /** Prefix for testIDs: `${prefix}-${sentenceId}-linked`, `${prefix}-word-${id}-${index}`, `${prefix}-grammar`. */
  testIDPrefix: string;
  sentenceId: string;
  /** Size and weight classes for the Japanese; colour is set per part. */
  textClassName?: string;
  /** Whether a word span opens its detail page; default: every word. */
  isLinked?: (vocabularyItemId: string) => boolean;
  /** Grammar cards: the highlighted grammar, not pressable while `locked`. */
  grammarSpan?: { start: number; end: number; locked: boolean; itemId: string };
};

const ALWAYS_LINKED = (): boolean => true;

/**
 * A Japanese sentence with linked vocabulary (Plan 11.6 / 14.1): tap opens the
 * word's detail page, long-press toggles its furigana, and furigana follows
 * that word's own mastery (FR78). Shared by example sentences and the grammar
 * review cards (spec §5.4).
 */
export function LinkedSentence({
  japanese,
  furigana,
  spans,
  testIDPrefix,
  sentenceId,
  textClassName = 'text-body-lg font-jp-medium',
  isLinked = ALWAYS_LINKED,
  grammarSpan,
}: LinkedSentenceProps) {
  const { userDb } = useDatabase();
  const { mode: furiganaMode, knownKanji, modeForItem } = useFuriganaPreference();
  const hrefFor = useItemHref();
  const grammarStart = grammarSpan?.start;
  const grammarEnd = grammarSpan?.end;
  const parts = useMemo(
    () =>
      buildPassageBodyParts(
        japanese,
        furigana,
        spans,
        grammarStart !== undefined && grammarEnd !== undefined
          ? { start: grammarStart, end: grammarEnd }
          : undefined,
      ),
    [japanese, furigana, spans, grammarStart, grammarEnd],
  );

  const hasLinks = parts.some((part) => part.vocabularyItemId !== null);
  if (!hasLinks && !grammarSpan) {
    return (
      <FuriganaText
        text={furigana ?? japanese}
        mode={furiganaMode}
        knownKanji={knownKanji}
        className={cn(textClassName, 'text-primary')}
      />
    );
  }

  return (
    <View className="flex-row flex-wrap items-end" testID={`${testIDPrefix}-${sentenceId}-linked`}>
      {parts.map((part, index) => {
        const key = `${index}-${part.surface}`;

        if (part.isGrammar && grammarSpan) {
          const grammarText = (
            <View className="rounded-radius-sm bg-content-grammar-soft">
              <FuriganaText
                text={part.text}
                mode={furiganaMode}
                knownKanji={knownKanji}
                interactive={false}
                className={cn(textClassName, 'font-jp-bold text-content-grammar-deep')}
              />
            </View>
          );
          if (grammarSpan.locked) {
            return (
              <View
                key={key}
                accessible
                accessibilityLabel={`${part.surface}, grammar, answer first to open it`}
                testID={`${testIDPrefix}-grammar`}>
                {grammarText}
              </View>
            );
          }
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${part.surface}, show grammar details`}
              onPress={() => router.push(hrefFor(grammarSpan.itemId) as Href)}
              testID={`${testIDPrefix}-grammar`}>
              {grammarText}
            </Pressable>
          );
        }

        if (part.vocabularyItemId === null) {
          return (
            <FuriganaText
              key={key}
              text={part.text}
              mode={furiganaMode}
              knownKanji={knownKanji}
              className={cn(textClassName, 'text-primary')}
            />
          );
        }

        const vocabularyItemId = part.vocabularyItemId;
        // A linked span *is* one vocabulary item, so its own mastery is the
        // whole answer (Tier 1) rather than a per-kanji check (Tier 2) — the
        // same distinction the word's own hero already uses (FR78 / BUG6).
        const isKnownWord = isVocabularyItemKnown(userDb, vocabularyItemId);

        if (!isLinked(vocabularyItemId)) {
          return (
            <FuriganaText
              key={key}
              text={part.text}
              mode={modeForItem(vocabularyItemId)}
              knownKanji={knownKanji}
              isKnownWord={isKnownWord}
              interactive={false}
              className={cn(textClassName, 'text-primary')}
            />
          );
        }

        // While the grammar is locked, a word cut by it must not name its
        // inflection: "食べた is the た-form" would hand over the answer.
        const inflection = grammarSpan?.locked && part.overlapsGrammar ? null : part.inflection;

        return (
          <LinkedWord
            key={key}
            text={part.text}
            surface={part.surface}
            vocabularyItemId={vocabularyItemId}
            inflection={inflection}
            textClassName={textClassName}
            testID={`${testIDPrefix}-word-${vocabularyItemId}-${index}`}
          />
        );
      })}
    </View>
  );
}
