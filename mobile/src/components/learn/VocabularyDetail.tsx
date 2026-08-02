import React from 'react';
import { View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { FuriganaOverrideControl } from '@/components/learn/FuriganaOverrideControl';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDescriptionSection } from '@/components/learn/ItemDescriptionSection';
import {
  DETAIL_HERO_FONT_SIZE,
  ItemDetailHeader,
} from '@/components/learn/ItemDetailHeader';
import { ItemMnemonicSections } from '@/components/learn/ItemMnemonicSections';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { UserSynonymEditor } from '@/components/learn/UserSynonymEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { RelatedItem } from '@/core/content/content.types';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  ExampleSentence,
  GrammarVocabLink,
} from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';
import { cn } from '@/utils/cn';

type VocabularyDetailProps = {
  item: CurriculumItemDetail;
  acceptedAnswers: AcceptedAnswer[];
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  parents?: CurriculumParentItem[];
  related?: RelatedItem[];
};

export function VocabularyDetail({
  item,
  acceptedAnswers,
  exampleSentences,
  grammarVocabLinks,
  parents = [],
  related = [],
}: VocabularyDetailProps) {
  const isLongWord = item.primaryForm.length > 4;
  const { modeForItem } = useFuriganaPreference();
  const isKnownWord = useIsKnownWord(item.id);

  return (
    <View testID="vocabulary-detail">
      <ItemDetailHeader itemType="vocabulary" meaning={item.meaning} showTypeBadge={false}>
        {/* The spec draws the reading as a small line above the glyph, which is
            exactly what FuriganaText already stacks — no separate reading row. */}
        <FuriganaText
          text={item.furigana ?? item.primaryForm}
          mode={modeForItem(item.id)}
          isKnownWord={isKnownWord}
          className={cn('font-jp-round-black', CONTENT_TYPE_ACCENT.vocabulary.deep)}
          style={isLongWord ? DETAIL_HERO_FONT_SIZE.pattern : DETAIL_HERO_FONT_SIZE.word}
        />
      </ItemDetailHeader>

      <AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />

      <FuriganaOverrideControl itemId={item.id} />

      <ItemMnemonicSections item={item} />

      <ItemDescriptionSection item={item} />

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
