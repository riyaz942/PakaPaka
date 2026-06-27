import React from 'react';
import { Text, View } from 'react-native';

import { KanjiDependencyHints } from '@/components/learn/KanjiDependencyHints';
import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  CurriculumParentItem,
  KanjiReading,
} from '@/data/curriculum/itemRepository';

type KanjiDetailProps = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  acceptedAnswers: AcceptedAnswer[];
  parents?: CurriculumParentItem[];
  isLocked?: boolean;
  unmetPrerequisites?: CurriculumParentItem[];
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
}: KanjiDetailProps) {
  const synonyms = synonymMeanings(acceptedAnswers);
  const onyomi = readingsByType(kanjiReadings, 'onyomi');
  const kunyomi = readingsByType(kanjiReadings, 'kunyomi');

  return (
    <View testID="kanji-detail">
      <Text className="text-display text-primary">{item.primaryForm}</Text>
      <Text className="mt-2 text-body text-primary">{item.meaning}</Text>

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
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Mnemonic</Text>
          <Text className="mt-1 text-body text-secondary">{item.mnemonicText}</Text>
        </View>
      ) : null}
    </View>
  );
}
