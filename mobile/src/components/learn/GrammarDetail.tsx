import React from 'react';
import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { LessonMarkdown } from '@/components/common/LessonMarkdown';
import { SectionHeading } from '@/components/common/SectionHeading';
import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import {
  DETAIL_HERO_FONT_SIZE,
  ItemDetailHeader,
} from '@/components/learn/ItemDetailHeader';
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
      <ItemDetailHeader itemType="grammar" meaning={item.meaning} showTypeBadge={false}>
        <Text
          className={cn('text-center font-jp-round-black', CONTENT_TYPE_ACCENT.grammar.deep)}
          style={DETAIL_HERO_FONT_SIZE.pattern}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      <AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />

      {grammarRule?.explanationMarkdown ? (
        <View className="mt-space-md" testID="grammar-lesson-body">
          <LessonMarkdown
            markdown={grammarRule.explanationMarkdown}
            mode={furiganaMode}
            knownKanji={knownKanji}
          />
        </View>
      ) : null}

      {grammarRule ? (
        <>
          <View className="mt-space-md">
            <SectionHeading label="Structure" />
            <Text className="mt-space-xs text-body-lg font-jp-medium text-primary">
              {grammarRule.structure}
            </Text>
          </View>

          {grammarRule.acceptedForms.length > 0 ? (
            <View className="mt-space-md">
              <SectionHeading label="Accepted forms" />
              <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
                {grammarRule.acceptedForms.map((form) => (
                  <View
                    key={form}
                    className="rounded-radius-sm bg-content-grammar-soft px-space-sm py-[6px]">
                    <Text className="text-body-sm font-jp-bold text-content-grammar-deep">
                      {form}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {Object.keys(grammarRule.conjugationRules).length > 0 ? (
            <View className="mt-space-md">
              <SectionHeading label="Conjugation rules" />
              {Object.entries(grammarRule.conjugationRules).map(([key, value]) => (
                <Text key={key} className="mt-space-xs text-body-sm font-ui-medium text-secondary">
                  {key}: {formatConjugationValue(value)}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {grammarRule && grammarRule.cautionNotes.length > 0 ? (
        <View className="mt-space-md" testID="grammar-caution-notes">
          <SectionHeading label="Watch out" className="text-feedback-warning-deep" />
          <View className="mt-space-sm gap-space-sm">
            {grammarRule.cautionNotes.map((note, index) => (
              <View
                key={index}
                className="flex-row items-start gap-space-sm rounded-radius-md bg-feedback-warning-soft px-space-md py-space-sm">
                <Icon
                  name="info"
                  size={17}
                  strokeWidth={2}
                  className="mt-[2px] text-feedback-warning-deep"
                />
                <Text className="flex-1 text-body-sm font-ui-medium text-feedback-warning-deep">
                  {note}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PersonalMnemonicEditor itemId={item.id} />

      <ExampleSentencesSection sentences={exampleSentences} testIDPrefix="grammar-example" />

      <ItemCrossReferences item={item} related={related} relatedGrammar={relatedGrammar} />
    </View>
  );
}
