import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { CompareEntryPoint } from '@/components/learn/CompareEntryPoint';
import { GrammarDetail } from '@/components/learn/GrammarDetail';
import { KanjiDetail } from '@/components/learn/KanjiDetail';
import { RadicalDetail } from '@/components/learn/RadicalDetail';
import { StudyStatusBanner } from '@/components/learn/StudyStatusBanner';
import { StudyStatusControl } from '@/components/learn/StudyStatusControl';
import { VocabularyDetail } from '@/components/learn/VocabularyDetail';
import type { WordInflection } from '@/core/content/inflection';
import { useComponentParents } from '@/data/hooks/useComponentParents';
import { useItemDependencyStatus } from '@/data/hooks/useItemDependencyStatus';
import { useItemDetail } from '@/data/hooks/useItemDetail';
import { useItemStudyStatus } from '@/data/hooks/useItemStudyStatus';
import { useRelatedItems } from '@/data/hooks/useRelatedItems';

type ItemDetailBodyProps = {
  itemId: string | null;
  /**
   * The conjugated surface the learner tapped to get here, and which taught
   * form it was (14.1) — set by the route params when they arrived from an
   * inflected span rather than the word's dictionary form.
   */
  surface?: string | null;
  inflection?: WordInflection | null;
  /** Set by `/review/item/[id]`: hides a grammar point's examples (see `GrammarDetail`). */
  inReview?: boolean;
};

/**
 * The details composition (FR71, FR76), shared by `/browse/item/[id]` and the
 * review-nested `/review/item/[id]` so the two surfaces cannot drift.
 *
 * Details is a reference scroll: a passive status banner, then the full item,
 * always fully visible. It is never a lesson entry point — the lesson
 * composition is `components/lesson/LessonItemView` (D-DET-1). The one button
 * here that touches lessons, `NotYetLearnedNote`'s opt-in, changes what a
 * future lesson contains without entering one.
 */
export function ItemDetailBody({
  itemId,
  surface = null,
  inflection = null,
  inReview = false,
}: ItemDetailBodyProps) {
  const {
    item,
    kanjiReadings,
    acceptedAnswers,
    grammarRule,
    exampleSentences,
    grammarVocabLinks,
    relatedGrammar,
    visuallySimilar,
    loading,
    notFound,
  } = useItemDetail(itemId);
  const { isLocked, unmetPrerequisites, loading: depsLoading } = useItemDependencyStatus(itemId);
  const componentParents = useComponentParents(itemId, item?.itemType ?? null);
  const studyStatus = useItemStudyStatus(itemId);
  const related = useRelatedItems(itemId, item?.itemType ?? null);

  if (loading || depsLoading) {
    return (
      <View className="mt-8 items-center">
        <ActivityIndicator accessibilityLabel="Loading item" />
      </View>
    );
  }

  if (notFound || !item) {
    return <Text className="mt-8 text-body text-secondary">Item not found.</Text>;
  }

  return (
    <>
      <StudyStatusBanner
        status={studyStatus}
        isLocked={isLocked}
        unmetPrerequisites={unmetPrerequisites}
      />

      <StudyStatusControl itemId={item.id} />

      {item.itemType === 'radical' ? (
        <RadicalDetail item={item} related={related} lookAlikes={visuallySimilar} />
      ) : item.itemType === 'kanji' ? (
        <KanjiDetail
          item={item}
          kanjiReadings={kanjiReadings ?? []}
          acceptedAnswers={acceptedAnswers}
          exampleSentences={exampleSentences}
          parents={componentParents}
          related={related}
          lookAlikes={visuallySimilar}
        />
      ) : item.itemType === 'vocabulary' ? (
        <VocabularyDetail
          item={item}
          acceptedAnswers={acceptedAnswers}
          exampleSentences={exampleSentences}
          grammarVocabLinks={grammarVocabLinks}
          parents={componentParents}
          related={related}
          surface={surface}
          inflection={inflection}
        />
      ) : item.itemType === 'grammar' ? (
        <GrammarDetail
          item={item}
          acceptedAnswers={acceptedAnswers}
          grammarRule={grammarRule}
          exampleSentences={exampleSentences}
          relatedGrammar={relatedGrammar}
          related={related}
          inReview={inReview}
        />
      ) : null}

      <CompareEntryPoint itemId={item.id} itemType={item.itemType} />
    </>
  );
}
