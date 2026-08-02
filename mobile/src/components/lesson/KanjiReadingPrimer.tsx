import React from 'react';
import { Text, View } from 'react-native';

import { EXPLAINER_CONTENT } from '@/components/learn/explainerContent';

/**
 * The on'yomi/kun'yomi primer, shown inline as section-1 content on a
 * beginner's first dual-reading kanji (FR74) — deliberately *not* a wall in
 * front of the lesson. Same copy as the heading explainer sheet, so the two
 * never drift.
 */
export function KanjiReadingPrimer() {
  const content = EXPLAINER_CONTENT['onyomi-kunyomi'];

  return (
    <View
      className="mt-4 gap-space-sm rounded-radius-lg border border-border bg-surface p-space-lg"
      testID="kanji-reading-primer">
      <Text accessibilityRole="header" className="text-body-lg font-ui-bold text-primary">
        {content.title}
      </Text>
      {content.paragraphs.map((paragraph, index) => (
        <Text key={index} className="text-body font-ui text-secondary">
          {paragraph}
        </Text>
      ))}
    </View>
  );
}
