import React from 'react';
import { View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { FuriganaOverrideControl } from '@/components/learn/FuriganaOverrideControl';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDetailHeader } from '@/components/learn/ItemDetailHeader';
import { MnemonicSection } from '@/components/learn/MnemonicSection';
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
      <ItemDetailHeader itemType="vocabulary" meaning={item.meaning}>
        <FuriganaText
          text={item.furigana ?? item.primaryForm}
          mode={modeForItem(item.id)}
          isKnownWord={isKnownWord}
          className={CONTENT_TYPE_ACCENT.vocabulary.text}
          style={isLongWord ? { fontSize: 28, lineHeight: 34 } : { fontSize: 48, lineHeight: 53 }}
        />
      </ItemDetailHeader>

      <AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />

      <FuriganaOverrideControl itemId={item.id} />

      {item.mnemonicText ? <MnemonicSection mnemonicText={item.mnemonicText} /> : null}

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
