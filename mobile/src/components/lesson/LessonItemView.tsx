import React from 'react';
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
};

/**
 * One lesson item, paged into three sections (D-DET-1, FR71).
 *
 * This is the *lesson* composition: it deliberately no longer renders the
 * Browse `*Detail` scroll. Both surfaces share section atoms (hero, mnemonic,
 * examples, cross-refs), but a lesson paces content while details is a single
 * reference scroll.
 */
export function LessonItemView({ itemId, sectionIndex }: LessonItemViewProps) {
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
