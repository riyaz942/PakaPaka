import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import { useItemLinkBase } from '@/components/learn/ItemLinkContext';
import type {
  CurriculumItemDetail,
  VisuallySimilarItem,
} from '@/data/curriculum/itemRepository';

type LookAlikeSectionProps = {
  item: CurriculumItemDetail;
  lookAlikes: VisuallySimilarItem[];
};

/**
 * Data-derived look-alike chips (content pipeline Rev 1) on radical/kanji
 * details. Each chip opens Compare with this item on the left and the
 * confusable on the right — the side-by-side glyphs are the point, so these
 * skip the plain detail route the other cross-reference chips use.
 *
 * The compare route follows the surface the detail is mounted on, for the same
 * reason `ItemLinkContext` exists: pushing `/browse/*` from inside a review
 * would leave the review Stack and destroy the session.
 */
export function LookAlikeSection({ item, lookAlikes }: LookAlikeSectionProps) {
  const base = useItemLinkBase();

  if (lookAlikes.length === 0) {
    return null;
  }

  const comparePathname = base === '/review/item' ? '/review/compare' : '/browse/compare';

  return (
    <View className="mt-4" testID="look-alike-section">
      <SectionHeading label="Easily confused with" />
      <View className="mt-2 flex-row flex-wrap gap-2">
        {lookAlikes.map((lookAlike) => (
          <Pressable
            key={lookAlike.id}
            accessibilityRole="button"
            accessibilityLabel={`Compare ${item.primaryForm} with ${lookAlike.primaryForm}, ${lookAlike.meaning}`}
            onPress={() =>
              router.push({
                pathname: comparePathname,
                params: { left: item.id, right: lookAlike.id },
              })
            }
            testID={`look-alike-${lookAlike.id}`}
            className="min-h-[44px] min-w-[44px] justify-center rounded-radius-md bg-surface px-3 py-2">
            <Text className="text-body text-feedback-info">{lookAlike.primaryForm}</Text>
            <Text className="text-caption text-secondary">{lookAlike.meaning}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
