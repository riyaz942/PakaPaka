import React from 'react';
import { Text, View } from 'react-native';

import { AcceptedAnswersDisclosure } from '@/components/learn/AcceptedAnswersDisclosure';
import { ExampleSentencesSection } from '@/components/learn/ExampleSentencesSection';
import { ItemCrossReferences } from '@/components/learn/ItemCrossReferences';
import { ItemDetailHeader } from '@/components/learn/ItemDetailHeader';
import { KanjiReadingsSection } from '@/components/learn/KanjiReadingsSection';
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
  KanjiReading,
} from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type KanjiDetailProps = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  acceptedAnswers: AcceptedAnswer[];
  exampleSentences?: ExampleSentence[];
  parents?: CurriculumParentItem[];
  related?: RelatedItem[];
};

/**
 * Kanji details: one vertical scroll of reference content (FR71). Never a
 * lesson entry point (FR76) — the lesson composition lives in
 * `components/lesson/` and is paced, not scrolled.
 */
export function KanjiDetail({
  item,
  kanjiReadings,
  acceptedAnswers,
  exampleSentences = [],
  parents = [],
  related = [],
}: KanjiDetailProps) {
  return (
    <View testID="kanji-detail">
      <ItemDetailHeader itemType="kanji" meaning={item.meaning}>
        <Text
          className={cn('text-center font-bold', CONTENT_TYPE_ACCENT.kanji.text)}
          style={{ fontSize: 48, lineHeight: 53 }}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      <KanjiReadingsSection kanjiReadings={kanjiReadings} />

      <AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />

      {item.mnemonicText ? <MnemonicSection mnemonicText={item.mnemonicText} /> : null}

      <PersonalMnemonicEditor itemId={item.id} />
      <UserSynonymEditor itemId={item.id} />

      <ExampleSentencesSection sentences={exampleSentences} testIDPrefix="kanji-example" />

      <ItemCrossReferences item={item} related={related} parents={parents} />
    </View>
  );
}
