import { type Href, router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { KanjiDependencyHints } from '@/components/learn/KanjiDependencyHints';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  ExampleSentence,
  GrammarVocabLink,
} from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type VocabularyDetailProps = {
  item: CurriculumItemDetail;
  acceptedAnswers: AcceptedAnswer[];
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  parents?: CurriculumParentItem[];
  isLocked?: boolean;
  unmetPrerequisites?: CurriculumParentItem[];
};

function synonymMeanings(acceptedAnswers: AcceptedAnswer[]): string[] {
  return acceptedAnswers
    .filter((answer) => answer.answerType === 'meaning' && !answer.isPrimary)
    .map((answer) => answer.answerText);
}

export function VocabularyDetail({
  item,
  acceptedAnswers,
  exampleSentences,
  grammarVocabLinks,
  parents,
  isLocked,
  unmetPrerequisites,
}: VocabularyDetailProps) {
  const synonyms = synonymMeanings(acceptedAnswers);
  const isLongWord = item.primaryForm.length > 4;

  return (
    <View testID="vocabulary-detail">
      <Text
        className={cn(
          'text-primary',
          isLongWord ? 'text-title-lg' : 'text-display',
        )}>
        {item.primaryForm}
      </Text>
      <Text className="mt-2 text-body text-primary">{item.meaning}</Text>

      {synonyms.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Synonyms</Text>
          <Text className="mt-1 text-body text-primary">{synonyms.join(', ')}</Text>
        </View>
      ) : null}

      {isLocked && unmetPrerequisites && unmetPrerequisites.length > 0 ? (
        <View className="mt-4" testID="item-detail-lock-section">
          <KanjiDependencyHints parents={unmetPrerequisites} mode="unmet" />
        </View>
      ) : null}

      {!isLocked && parents && parents.length > 0 ? (
        <View className="mt-4" testID="item-detail-available-section">
          <Text className="text-body-sm text-feedback-correct">Prerequisites met</Text>
        </View>
      ) : null}

      {item.mnemonicText ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Mnemonic</Text>
          <Text className="mt-1 text-body text-secondary">{item.mnemonicText}</Text>
        </View>
      ) : null}

      <PersonalMnemonicEditor itemId={item.id} />

      {exampleSentences.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Examples</Text>
          {exampleSentences.map((sentence) => (
            <View key={sentence.id} className="mt-2" testID={`vocab-example-${sentence.id}`}>
              <Text className="text-body text-primary">{sentence.japanese}</Text>
              <Text className="mt-1 text-body text-secondary">{sentence.english}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {grammarVocabLinks.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Grammar</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {grammarVocabLinks.map((link) => (
              <Pressable
                key={link.grammarItemId}
                accessibilityRole="button"
                accessibilityLabel={`Grammar point ${link.vocabularyPrimaryForm}`}
                onPress={() => router.push(`/learn/item/${link.grammarItemId}` as Href)}
                testID={`grammar-link-${link.grammarItemId}`}
                className="min-h-[44px] min-w-[44px] justify-center rounded-md bg-surface px-3 py-2">
                <Text className="text-body text-feedback-info">{link.vocabularyPrimaryForm}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
