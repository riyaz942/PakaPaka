import React from 'react';
import { Text, View } from 'react-native';

import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  ExampleSentence,
  GrammarRule,
} from '@/data/curriculum/itemRepository';

type GrammarDetailProps = {
  item: CurriculumItemDetail;
  acceptedAnswers: AcceptedAnswer[];
  grammarRule: GrammarRule | null;
  exampleSentences: ExampleSentence[];
};

function synonymMeanings(acceptedAnswers: AcceptedAnswer[]): string[] {
  return acceptedAnswers
    .filter((answer) => answer.answerType === 'meaning' && !answer.isPrimary)
    .map((answer) => answer.answerText);
}

function formatConjugationValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function GrammarDetail({
  item,
  acceptedAnswers,
  grammarRule,
  exampleSentences,
}: GrammarDetailProps) {
  const synonyms = synonymMeanings(acceptedAnswers);

  return (
    <View testID="grammar-detail">
      <Text className="font-mono text-title-lg text-primary">{item.primaryForm}</Text>
      <Text className="mt-2 text-body text-primary">{item.meaning}</Text>

      {synonyms.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Synonyms</Text>
          <Text className="mt-1 text-body text-primary">{synonyms.join(', ')}</Text>
        </View>
      ) : null}

      {grammarRule ? (
        <>
          <View className="mt-4">
            <Text className="text-body-sm uppercase text-secondary">Structure</Text>
            <Text className="mt-1 text-body text-primary">{grammarRule.structure}</Text>
          </View>

          {grammarRule.acceptedForms.length > 0 ? (
            <View className="mt-4">
              <Text className="text-body-sm uppercase text-secondary">Accepted forms</Text>
              {grammarRule.acceptedForms.map((form) => (
                <Text key={form} className="mt-1 text-body text-primary">
                  • {form}
                </Text>
              ))}
            </View>
          ) : null}

          {Object.keys(grammarRule.conjugationRules).length > 0 ? (
            <View className="mt-4">
              <Text className="text-body-sm uppercase text-secondary">Conjugation rules</Text>
              {Object.entries(grammarRule.conjugationRules).map(([key, value]) => (
                <Text key={key} className="mt-1 text-body text-primary">
                  {key}: {formatConjugationValue(value)}
                </Text>
              ))}
            </View>
          ) : null}
        </>
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
            <View key={sentence.id} className="mt-2" testID={`grammar-example-${sentence.id}`}>
              <Text className="text-body text-primary">{sentence.japanese}</Text>
              <Text className="mt-1 text-body text-secondary">{sentence.english}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
