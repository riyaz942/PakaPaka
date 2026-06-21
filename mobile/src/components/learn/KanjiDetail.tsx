import React from 'react';
import { Text, View } from 'react-native';

import type {
  AcceptedAnswer,
  CurriculumItemDetail,
  KanjiReading,
} from '@/data/curriculum/itemRepository';

type KanjiDetailProps = {
  item: CurriculumItemDetail;
  kanjiReadings: KanjiReading[];
  acceptedAnswers: AcceptedAnswer[];
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

export function KanjiDetail({ item, kanjiReadings, acceptedAnswers }: KanjiDetailProps) {
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

      {item.mnemonicText ? (
        <View className="mt-4">
          <Text className="text-body-sm uppercase text-secondary">Mnemonic</Text>
          <Text className="mt-1 text-body text-secondary">{item.mnemonicText}</Text>
        </View>
      ) : null}
    </View>
  );
}
