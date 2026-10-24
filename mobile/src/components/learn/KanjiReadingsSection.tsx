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
 * On'yomi leads as a surface card: a kicker naming the reading kind and the
 * readings themselves in the Japanese face. Kun'yomi is still listed, but as a
 * quiet note under it — the kanji mnemonic and review teach on'yomi only, and
 * each kun'yomi is learned through the vocabulary that uses it. The card heading
 * carries the reading-primer explainer, so a learner who dismissed (or never
 * got) the unprompted primer can still reach it from any kanji, forever (FR74).
 *
 * A kanji with only kun'yomi keeps the full card, since there is nothing to lead
 * with instead.
 */
function ReadingCard({
  label,
  readings,
  testID,
}: {
  label: string;
  readings: string[];
  testID: string;
}) {
  return (
    <View
      className="rounded-radius-md border border-border bg-surface px-space-md py-space-sm shadow-e1"
      testID={testID}>
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

  if (onyomi.length === 0) {
    return (
      <View className="mt-space-md" testID="kanji-readings">
        <ReadingCard label="Kun'yomi" readings={kunyomi} testID="kanji-kunyomi-card" />
      </View>
    );
  }

  return (
    <View className="mt-space-md" testID="kanji-readings">
      <ReadingCard label="On'yomi" readings={onyomi} testID="kanji-onyomi-card" />
      {kunyomi.length > 0 ? (
        <View
          className="mt-space-sm flex-row flex-wrap items-baseline gap-x-space-xs px-space-md"
          testID="kanji-kunyomi-note">
          <Text className="text-caption font-ui-bold uppercase tracking-[0.12em] text-faint">
            {"Kun'yomi"}
          </Text>
          <Text className="text-body-sm font-jp-medium text-secondary">{kunyomi.join('、')}</Text>
          <Text className="text-caption font-ui text-muted">·</Text>
          <Text className="text-caption font-ui text-muted">You learn these with the vocabulary</Text>
        </View>
      ) : null}
    </View>
  );
}
