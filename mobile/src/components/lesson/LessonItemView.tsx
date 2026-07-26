import React, { useLayoutEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  LESSON_SECTION_LABELS,
  LessonExamplesSection,
  LessonIntroSection,
  LessonMnemonicSectionView,
  type LessonSectionProps,
} from '@/components/lesson/LessonItemSections';
import { useComponentParents } from '@/data/hooks/useComponentParents';
import { useItemDetail } from '@/data/hooks/useItemDetail';
import { useKanjiReadingPrimer } from '@/data/hooks/useKanjiReadingPrimer';

type LessonItemViewProps = {
  itemId: string;
  /** 0-based index into the three lesson sections; owned by the session loop. */
  sectionIndex: number;
  /**
   * Fired after layout when this card's content is ready to show. The lesson
   * swipe uses it to start the enter animation only once the swapped card is
   * painted — not while the previous item is still on screen.
   */
  onContentReady?: () => void;
};

/**
 * One lesson item, paged into three sections (D-DET-1, FR71).
 *
 * This is the *lesson* composition: it deliberately no longer renders the
 * Browse `*Detail` scroll. Both surfaces share section atoms (hero, mnemonic,
 * examples, cross-refs), but a lesson paces content while details is a single
 * reference scroll.
 */
export function LessonItemView({
  itemId,
  sectionIndex,
  onContentReady,
}: LessonItemViewProps) {
  const {
    item,
    kanjiReadings,
    grammarRule,
    exampleSentences,
    grammarVocabLinks,
    relatedGrammar,
    loading,
    notFound,
  } = useItemDetail(itemId);
  const parents = useComponentParents(itemId, item?.itemType ?? null);

  const readings = kanjiReadings ?? [];
  const isDualReadingKanji =
    item?.itemType === 'kanji' &&
    readings.some((reading) => reading.readingType === 'onyomi') &&
    readings.some((reading) => reading.readingType === 'kunyomi');
  const showReadingPrimer = useKanjiReadingPrimer({
    itemId: loading ? null : itemId,
    isDualReadingKanji,
  });

  // Tell the session loop as soon as this card is paint-ready (including the
  // not-found path — still a settled UI). Section changes re-fire so an enter
  // animation waiting on the same item can proceed.
  useLayoutEffect(() => {
    if (!loading) {
      onContentReady?.();
    }
  }, [loading, itemId, sectionIndex, onContentReady]);

  if (loading) {
    return (
      <View className="mt-space-xl items-center">
        <ActivityIndicator accessibilityLabel="Loading item" />
      </View>
    );
  }

  if (notFound || !item) {
    return <Text className="mt-space-xl text-body text-secondary">Item not found.</Text>;
  }

  const sectionProps: LessonSectionProps = {
    item,
    kanjiReadings: readings,
    grammarRule,
    exampleSentences,
    grammarVocabLinks,
    relatedGrammar,
    parents,
    showReadingPrimer,
  };

  return (
    <View>
      <Text className="text-overline uppercase text-secondary" testID="lesson-section-label">
        {`${LESSON_SECTION_LABELS[sectionIndex] ?? LESSON_SECTION_LABELS[0]} · ${
          sectionIndex + 1
        } of ${LESSON_SECTION_LABELS.length}`}
      </Text>

      {sectionIndex === 0 ? <LessonIntroSection {...sectionProps} /> : null}
      {sectionIndex === 1 ? <LessonMnemonicSectionView {...sectionProps} /> : null}
      {sectionIndex >= 2 ? <LessonExamplesSection {...sectionProps} /> : null}
    </View>
  );
}
