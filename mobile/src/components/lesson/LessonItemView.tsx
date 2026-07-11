import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { GrammarDetail } from '@/components/learn/GrammarDetail';
import { KanjiDetail } from '@/components/learn/KanjiDetail';
import { RadicalDetail } from '@/components/learn/RadicalDetail';
import { VocabularyDetail } from '@/components/learn/VocabularyDetail';
import { useItemDependencyStatus } from '@/data/hooks/useItemDependencyStatus';
import { useItemDetail } from '@/data/hooks/useItemDetail';

type LessonItemViewProps = {
  itemId: string;
};

/** Renders the full teach card for one lesson item, reusing the Learn detail views. */
export function LessonItemView({ itemId }: LessonItemViewProps) {
  const {
    item,
    kanjiReadings,
    acceptedAnswers,
    grammarRule,
    exampleSentences,
    grammarVocabLinks,
    loading,
    notFound,
  } = useItemDetail(itemId);
  const { parents, isLocked, unmetPrerequisites } = useItemDependencyStatus(itemId);

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

  switch (item.itemType) {
    case 'radical':
      return <RadicalDetail item={item} size="lg" />;
    case 'kanji':
      return (
        <KanjiDetail
          item={item}
          kanjiReadings={kanjiReadings ?? []}
          acceptedAnswers={acceptedAnswers}
          parents={parents}
          isLocked={isLocked}
          unmetPrerequisites={unmetPrerequisites}
          size="lg"
          mnemonicCollapsible
        />
      );
    case 'vocabulary':
      return (
        <VocabularyDetail
          item={item}
          acceptedAnswers={acceptedAnswers}
          exampleSentences={exampleSentences}
          grammarVocabLinks={grammarVocabLinks}
          parents={parents}
          isLocked={isLocked}
          unmetPrerequisites={unmetPrerequisites}
          size="lg"
          mnemonicCollapsible
        />
      );
    case 'grammar':
      return (
        <GrammarDetail
          item={item}
          acceptedAnswers={acceptedAnswers}
          grammarRule={grammarRule}
          exampleSentences={exampleSentences}
          size="lg"
          mnemonicCollapsible
        />
      );
    default:
      return null;
  }
}
