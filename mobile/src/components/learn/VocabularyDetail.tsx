import { type Href, router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { HERO_FONT_SIZE, ItemDetailHeader, type HeroSize } from '@/components/learn/ItemDetailHeader';
import { KanjiDependencyHints } from '@/components/learn/KanjiDependencyHints';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  ExampleSentence,
  GrammarVocabLink,
} from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';

type VocabularyDetailProps = {
  item: CurriculumItemDetail;
  acceptedAnswers: AcceptedAnswer[];
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  parents?: CurriculumParentItem[];
  isLocked?: boolean;
  unmetPrerequisites?: CurriculumParentItem[];
  size?: HeroSize;
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
  size = 'md',
}: VocabularyDetailProps) {
  const synonyms = synonymMeanings(acceptedAnswers);
  const isLongWord = item.primaryForm.length > 4;
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const formSizeStyle =
    size === 'lg'
      ? isLongWord
        ? HERO_FONT_SIZE.word
        : HERO_FONT_SIZE.glyph
      : isLongWord
        ? { fontSize: 28, lineHeight: 34 }
        : { fontSize: 48, lineHeight: 53 };

  return (
    <View testID="vocabulary-detail">
      <ItemDetailHeader itemType="vocabulary" meaning={item.meaning} size={size}>
        <FuriganaText
          text={item.furigana ?? item.primaryForm}
          mode={furiganaMode}
          knownKanji={knownKanji}
          className={CONTENT_TYPE_ACCENT.vocabulary.text}
          style={formSizeStyle}
        />
      </ItemDetailHeader>

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
