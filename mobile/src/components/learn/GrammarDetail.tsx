import React from 'react';
import { Text, View } from 'react-native';

import { LessonMarkdown } from '@/components/common/LessonMarkdown';
import { SectionHeading } from '@/components/common/SectionHeading';
import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDetailHeader } from '@/components/learn/ItemDetailHeader';
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
              <SectionHeading label="Conjugation rules" />
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

      <PersonalMnemonicEditor itemId={item.id} />

      <ExampleSentencesSection sentences={exampleSentences} testIDPrefix="grammar-example" />

      <ItemCrossReferences item={item} related={related} relatedGrammar={relatedGrammar} />
    </View>
  );
}
