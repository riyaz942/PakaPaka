import React from 'react';
import { Text, View } from 'react-native';

import { HERO_FONT_SIZE, ItemDetailHeader, type HeroSize } from '@/components/learn/ItemDetailHeader';
import { KanjiDependencyHints } from '@/components/learn/KanjiDependencyHints';
import { MnemonicSection } from '@/components/learn/MnemonicSection';
import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { UserSynonymEditor } from '@/components/learn/UserSynonymEditor';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  KanjiReading,
} from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type KanjiDetailProps = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  acceptedAnswers: AcceptedAnswer[];
  parents?: CurriculumParentItem[];
  isLocked?: boolean;
  unmetPrerequisites?: CurriculumParentItem[];
  size?: HeroSize;
  /** Collapse the mnemonic behind a disclosure (lesson sessions). */
  mnemonicCollapsible?: boolean;
};

function synonymMeanings(acceptedAnswers: AcceptedAnswer[]): string[] {
  return acceptedAnswers
    .filter((answer) => answer.answerType === 'meaning' && !answer.isPrimary)
    .map((answer) => answer.answerText);
}

function readingsByType(
  kanjiReadings: KanjiReading[],
  readingType: 'onyomi' | 'kunyomi',
): string[] {
  return kanjiReadings
    .filter((reading) => reading.readingType === readingType)
    .map((reading) => reading.reading);
}

export function KanjiDetail({
  item,
  kanjiReadings,
  acceptedAnswers,
  parents,
  isLocked,
  unmetPrerequisites,
  size = 'md',
  mnemonicCollapsible = false,
}: KanjiDetailProps) {
  const synonyms = synonymMeanings(acceptedAnswers);
  const onyomi = readingsByType(kanjiReadings, 'onyomi');
  const kunyomi = readingsByType(kanjiReadings, 'kunyomi');

  return (
    <View testID="kanji-detail">
      <ItemDetailHeader itemType="kanji" meaning={item.meaning} size={size}>
        <Text
          className={cn('text-center font-bold', CONTENT_TYPE_ACCENT.kanji.text)}
          style={size === 'lg' ? HERO_FONT_SIZE.glyph : { fontSize: 48, lineHeight: 53 }}>
          {item.primaryForm}
        </Text>
      </ItemDetailHeader>

      {synonyms.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Synonyms</Text>
          <Text className="mt-1 text-body text-primary">{synonyms.join(', ')}</Text>
        </View>
      ) : null}

      {onyomi.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">{"On'yomi"}</Text>
          <Text className="mt-1 text-body text-primary">{onyomi.join(', ')}</Text>
        </View>
      ) : null}

      {kunyomi.length > 0 ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">{"Kun'yomi"}</Text>
          <Text className="mt-1 text-body text-primary">{kunyomi.join(', ')}</Text>
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
        <MnemonicSection mnemonicText={item.mnemonicText} collapsible={mnemonicCollapsible} />
      ) : null}

      <PersonalMnemonicEditor itemId={item.id} />
      <UserSynonymEditor itemId={item.id} />
    </View>
  );
}
