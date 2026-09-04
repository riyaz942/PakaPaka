import React from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { GuidanceCardNotice } from '@/components/common/GuidanceCardNotice';
import { SectionHeading } from '@/components/common/SectionHeading';
import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ConjugatedFormsSection } from '@/components/learn/ConjugatedFormsSection';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { FuriganaOverrideControl } from '@/components/learn/FuriganaOverrideControl';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDescriptionSection } from '@/components/learn/ItemDescriptionSection';
import {
  DETAIL_HERO_FONT_SIZE,
  ItemDetailHeader,
  heroWeightClass,
} from '@/components/learn/ItemDetailHeader';
import { ItemMnemonicSections } from '@/components/learn/ItemMnemonicSections';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { UserSynonymEditor } from '@/components/learn/UserSynonymEditor';
import { VocabularyReadingSection } from '@/components/learn/VocabularyReadingSection';
import { GUIDANCE_CARD_BY_ID } from '@/components/onboarding/cardRegistry';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { RelatedItem } from '@/core/content/content.types';
import { conjugatedFormNote, type WordInflection } from '@/core/content/inflection';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  ExampleSentence,
  GrammarVocabLink,
} from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useGuidanceCard } from '@/data/hooks/useGuidanceCard';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { cn } from '@/utils/cn';

type VocabularyDetailProps = {
  item: CurriculumItemDetail;
  acceptedAnswers: AcceptedAnswer[];
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  parents?: CurriculumParentItem[];
  related?: RelatedItem[];
  /** Conjugated surface the learner tapped to get here, when they came from one. */
  surface?: string | null;
  /** Which taught form that surface was (14.1). */
  inflection?: WordInflection | null;
};

export function VocabularyDetail({
  item,
  acceptedAnswers,
  exampleSentences,
  grammarVocabLinks,
  parents = [],
  related = [],
  surface = null,
  inflection = null,
}: VocabularyDetailProps) {
  const isLongWord = item.primaryForm.length > 4;
  const heroSize = isLongWord ? DETAIL_HERO_FONT_SIZE.pattern : DETAIL_HERO_FONT_SIZE.word;
  const { modeForItem } = useFuriganaPreference();
  const isKnownWord = useIsKnownWord(item.id);
  // Mastery is what hid the reading; an explicit per-word override means it was
  // not auto-hidden, so there is nothing to explain.
  const furiganaAutoHideCard = useGuidanceCard(
    'furigana-auto-hide',
    isKnownWord && modeForItem(item.id) === 'auto',
  );
  // The page heroes the dictionary form; this names the conjugation that sent
  // the learner here so the two forms connect (14.1).
  const conjugatedNote = conjugatedFormNote(surface, item.primaryForm, inflection);

  return (
    <View testID="vocabulary-detail">
      <ItemDetailHeader itemType="vocabulary" meaning={item.meaning} showTypeBadge={false}>
        {/* The spec draws the reading as a small line above the glyph, which is
            exactly what FuriganaText already stacks — no separate reading row. */}
        <FuriganaText
          text={item.furigana ?? item.primaryForm}
          mode={modeForItem(item.id)}
          isKnownWord={isKnownWord}
          className={cn(heroWeightClass(heroSize), CONTENT_TYPE_ACCENT.vocabulary.deep)}
          style={heroSize}
        />
      </ItemDetailHeader>

      <VocabularyReadingSection furigana={item.furigana} primaryForm={item.primaryForm} />

      {/* Part of speech, sitting with the word's other facts rather than down
          with the mnemonics — it changes how the word is *used*, so it belongs
          next to the reading. Absent on the compound forms taught as grammar,
          which have no single part of speech to name. */}
      {item.wordType ? (
        <View className="mt-space-md" testID="vocabulary-word-type">
          <SectionHeading label="Word type" />
          <Text className="mt-space-xs text-body-sm font-ui-medium text-secondary">
            {item.wordType}
          </Text>
        </View>
      ) : null}

      {/* How the reading is built. Computed in the content pipeline, which is
          why it sits here among the word's facts and not with the mnemonics:
          for most words it is the *only* thing said about the reading, because
          a reading mnemonic is written only where the sound needs a hook. */}
      {item.readingComposition ? (
        <View className="mt-space-md" testID="vocabulary-reading-composition">
          <SectionHeading label="Reading composition" />
          <Text className="mt-space-xs text-body-sm font-ui text-secondary">
            {item.readingComposition}
          </Text>
        </View>
      ) : null}

      {conjugatedNote ? (
        <Text
          testID="conjugated-form-note"
          className="mt-space-sm text-center text-body-sm font-ui text-secondary">
          {conjugatedNote}
        </Text>
      ) : null}

      <AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />

      {furiganaAutoHideCard.visible ? (
        <GuidanceCardNotice
          card={GUIDANCE_CARD_BY_ID['furigana-auto-hide']}
          onDismiss={furiganaAutoHideCard.dismiss}
        />
      ) : null}

      <FuriganaOverrideControl itemId={item.id} />

      <ItemMnemonicSections item={item} />

      <ItemDescriptionSection item={item} />

      <ConjugatedFormsSection itemId={item.id} />

      <PersonalMnemonicEditor itemId={item.id} />
      <UserSynonymEditor itemId={item.id} />

      <ExampleSentencesSection sentences={exampleSentences} testIDPrefix="vocab-example" />

      <ItemCrossReferences
        item={item}
        related={related}
        parents={parents}
        grammarVocabLinks={grammarVocabLinks}
      />
    </View>
  );
}
