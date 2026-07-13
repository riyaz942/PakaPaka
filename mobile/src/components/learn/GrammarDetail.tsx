import { router, type Href } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { LessonMarkdown } from '@/components/common/LessonMarkdown';
import { HERO_FONT_SIZE, ItemDetailHeader, type HeroSize } from '@/components/learn/ItemDetailHeader';
import { MnemonicSection } from '@/components/learn/MnemonicSection';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  ExampleSentence,
  GrammarRule,
  RelatedGrammarItem,
} from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { cn } from '@/utils/cn';

type GrammarDetailProps = {
  item: CurriculumItemDetail;
  acceptedAnswers: AcceptedAnswer[];
  grammarRule: GrammarRule | null;
  exampleSentences: ExampleSentence[];
  relatedGrammar?: RelatedGrammarItem[];
  size?: HeroSize;
  /** Collapse the mnemonic behind a disclosure (lesson sessions). */
  mnemonicCollapsible?: boolean;
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
  relatedGrammar = [],
  size = 'md',
  mnemonicCollapsible = false,
}: GrammarDetailProps) {
  const synonyms = synonymMeanings(acceptedAnswers);
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();

  return (
    <View testID="grammar-detail">
      <ItemDetailHeader itemType="grammar" meaning={item.meaning} size={size}>
        <Text
          className={cn('font-mono text-center font-bold', CONTENT_TYPE_ACCENT.grammar.text)}
          style={size === 'lg' ? HERO_FONT_SIZE.pattern : { fontSize: 28, lineHeight: 34 }}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      {synonyms.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Synonyms</Text>
          <Text className="mt-1 text-body text-primary">{synonyms.join(', ')}</Text>
        </View>
      ) : null}

      {grammarRule?.explanationMarkdown ? (
        <View className="mt-4" testID="grammar-lesson-body">
          <LessonMarkdown
            markdown={grammarRule.explanationMarkdown}
            mode={furiganaMode}
            knownKanji={knownKanji}
          />
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

      {grammarRule && grammarRule.cautionNotes.length > 0 ? (
        <View className="mt-4" testID="grammar-caution-notes">
          <Text className="text-body-sm uppercase text-feedback-warning">Watch out</Text>
          {grammarRule.cautionNotes.map((note, index) => (
            <View
              key={index}
              className="mt-2 border-l-2 border-feedback-warning pl-space-md py-space-xs">
              <Text className="text-body text-primary">{note}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {item.mnemonicText ? (
        <MnemonicSection mnemonicText={item.mnemonicText} collapsible={mnemonicCollapsible} />
      ) : null}

      <PersonalMnemonicEditor itemId={item.id} />

      {exampleSentences.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Examples</Text>
          {exampleSentences.map((sentence) => (
            <View key={sentence.id} className="mt-2" testID={`grammar-example-${sentence.id}`}>
              <FuriganaText
                text={sentence.furigana ?? sentence.japanese}
                mode={furiganaMode}
                knownKanji={knownKanji}
                className="text-body text-primary"
              />
              <Text className="mt-1 text-body text-secondary">{sentence.english}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {relatedGrammar.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Related grammar</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {relatedGrammar.map((related) => (
              <Pressable
                key={related.id}
                accessibilityRole="button"
                accessibilityLabel={`Related grammar ${related.primaryForm}, ${related.meaning}`}
                onPress={() => router.push(`/learn/item/${related.id}` as Href)}
                testID={`related-grammar-${related.id}`}
                className="min-h-[44px] min-w-[44px] justify-center rounded-md bg-surface px-3 py-2">
                <Text className="text-body text-feedback-info">{related.primaryForm}</Text>
                <Text className="text-caption text-secondary">{related.meaning}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
