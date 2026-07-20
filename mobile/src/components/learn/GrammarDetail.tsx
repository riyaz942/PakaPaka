import { router, type Href } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { LessonMarkdown } from '@/components/common/LessonMarkdown';
import { SectionHeading } from '@/components/common/SectionHeading';
import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDetailHeader } from '@/components/learn/ItemDetailHeader';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { MnemonicSection } from '@/components/learn/MnemonicSection';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { RelatedItem } from '@/core/content/content.types';
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
  related?: RelatedItem[];
};

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
  related = [],
}: GrammarDetailProps) {
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const hrefFor = useItemHref();

  return (
    <View testID="grammar-detail">
      <ItemDetailHeader itemType="grammar" meaning={item.meaning}>
        <Text
          className={cn('font-mono text-center font-bold', CONTENT_TYPE_ACCENT.grammar.text)}
          style={{ fontSize: 28, lineHeight: 34 }}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      <AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />

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
            <SectionHeading label="Structure" />
            <Text className="mt-1 text-body text-primary">{grammarRule.structure}</Text>
          </View>

          {grammarRule.acceptedForms.length > 0 ? (
            <View className="mt-4">
              <SectionHeading label="Accepted forms" />
              {grammarRule.acceptedForms.map((form) => (
                <Text key={form} className="mt-1 text-body text-primary">
                  • {form}
                </Text>
              ))}
            </View>
          ) : null}

          {Object.keys(grammarRule.conjugationRules).length > 0 ? (
            <View className="mt-4">
              <SectionHeading label="Conjugation rules" infoTopic="transitive" />
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

      {item.mnemonicText ? <MnemonicSection mnemonicText={item.mnemonicText} /> : null}

      <PersonalMnemonicEditor itemId={item.id} />

      <ExampleSentencesSection sentences={exampleSentences} testIDPrefix="grammar-example" />

      <ItemCrossReferences item={item} related={related} />

      {relatedGrammar.length > 0 ? (
        <View className="mt-4">
          <SectionHeading label="Related grammar" />
          <View className="mt-2 flex-row flex-wrap gap-2">
            {relatedGrammar.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityRole="link"
                accessibilityLabel={`Related grammar ${entry.primaryForm}, ${entry.meaning}`}
                onPress={() => router.push(hrefFor(entry.id) as Href)}
                testID={`related-grammar-${entry.id}`}
                className="min-h-[44px] min-w-[44px] justify-center rounded-radius-md bg-surface px-3 py-2">
                <Text className="text-body text-feedback-info">{entry.primaryForm}</Text>
                <Text className="text-caption text-secondary">{entry.meaning}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
