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
 * On'yomi / kun'yomi as two side-by-side surface cards, the way the spec draws
 * them: a kicker naming the reading kind and the readings themselves in the
 * Japanese face. Both headings carry the reading-primer explainer, so a learner
 * who dismissed (or never got) the unprompted primer can still reach it from any
 * kanji, forever (FR74).
 *
 * A kanji with only one kind of reading gets one full-width card rather than a
 * half-width one next to a gap.
 */
function ReadingCard({
  label,
  readings,
}: {
  label: string;
  readings: string[];
}) {
  return (
    <View className="flex-1 rounded-radius-md border border-border bg-surface px-space-md py-space-sm shadow-e1">
      <SectionHeading label={label} infoTopic="onyomi-kunyomi" />
      <Text className="mt-[5px] text-title font-jp-bold text-primary">{readings.join('、')}</Text>
    </View>
  );
}

export function KanjiReadingsSection({ kanjiReadings }: KanjiReadingsSectionProps) {
  const onyomi = readingsByType(kanjiReadings, 'onyomi');
  const kunyomi = readingsByType(kanjiReadings, 'kunyomi');

  if (onyomi.length === 0 && kunyomi.length === 0) {
    return null;
  }

  return (
    <View className="mt-space-md flex-row gap-space-sm" testID="kanji-readings">
      {onyomi.length > 0 ? <ReadingCard label="On'yomi" readings={onyomi} /> : null}
      {kunyomi.length > 0 ? <ReadingCard label="Kun'yomi" readings={kunyomi} /> : null}
    </View>
  );
}
