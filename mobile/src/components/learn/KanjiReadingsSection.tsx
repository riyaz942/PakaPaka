import React from 'react';
import { Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import type { KanjiReading } from '@/data/curriculum/itemRepository';

type KanjiReadingsSectionProps = {
  kanjiReadings: KanjiReading[];
};

export function readingsByType(
  kanjiReadings: KanjiReading[],
  readingType: 'onyomi' | 'kunyomi',
): string[] {
  return kanjiReadings
    .filter((reading) => reading.readingType === readingType)
    .map((reading) => reading.reading);
}

/**
 * On'yomi / kun'yomi rows. Both headings carry the reading-primer explainer, so
 * a learner who dismissed (or never got) the unprompted primer can still reach
 * it from any kanji, forever (FR74).
 */
export function KanjiReadingsSection({ kanjiReadings }: KanjiReadingsSectionProps) {
  const onyomi = readingsByType(kanjiReadings, 'onyomi');
  const kunyomi = readingsByType(kanjiReadings, 'kunyomi');

  return (
    <>
      {onyomi.length > 0 ? (
        <View className="mt-4">
          <SectionHeading label="On'yomi" infoTopic="onyomi-kunyomi" />
          <Text className="mt-1 text-body text-primary">{onyomi.join(', ')}</Text>
        </View>
      ) : null}

      {kunyomi.length > 0 ? (
        <View className="mt-4">
          <SectionHeading label="Kun'yomi" infoTopic="onyomi-kunyomi" />
          <Text className="mt-1 text-body text-primary">{kunyomi.join(', ')}</Text>
        </View>
      ) : null}
    </>
  );
}
