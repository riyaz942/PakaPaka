import { router, type Href } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { LinkedItemTile, type LinkedItemTileVariant } from '@/components/common/LinkedItemTile';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { ExplainerTopic } from '@/components/learn/explainerContent';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

export type CrossReferenceChip = {
  id: string;
  itemType: ItemType;
  primaryForm: string;
  meaning?: string;
};

type CrossReferenceSectionProps = {
  label: string;
  items: CrossReferenceChip[];
  infoTopic?: ExplainerTopic;
  /** Soft tiles for the parts an item is made of; surface for what it leads to. */
  tileVariant?: LinkedItemTileVariant;
  /**
   * Frames the whole section in this type's soft card, kicker included — the
   * spec's treatment for grammar reached from a word.
   */
  cardType?: ItemType;
  testID?: string;
};

/**
 * Browsable tiles for one cross-reference direction (FR72).
 *
 * Settled empty-state policy: an empty set renders nothing at all — no empty
 * "Related" shell. Every tile is always browsable regardless of lock or study
 * status; a detail screen informs, it never withholds (FR76).
 */
export function CrossReferenceSection({
  label,
  items,
  infoTopic,
  tileVariant = 'surface',
  cardType,
  testID,
}: CrossReferenceSectionProps) {
  const hrefFor = useItemHref();

  if (items.length === 0) {
    return null;
  }

  const cardAccent = cardType ? CONTENT_TYPE_ACCENT[cardType] : null;

  return (
    <View
      className={cn(
        'mt-space-md',
        cardAccent && `rounded-radius-md p-space-md ${cardAccent.soft}`,
      )}
      testID={testID}>
      <SectionHeading
        label={label}
        infoTopic={infoTopic}
        className={cardAccent?.deep}
      />
      <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
        {items.map((item) => (
          <LinkedItemTile
            key={item.id}
            itemType={item.itemType}
            form={item.primaryForm}
            meaning={item.meaning}
            variant={tileVariant}
            accessibilityRole="link"
            accessibilityLabel={
              item.meaning ? `${item.primaryForm}, ${item.meaning}` : item.primaryForm
            }
            onPress={() => router.push(hrefFor(item.id) as Href)}
            testID={testID ? `${testID}-${item.id}` : `cross-ref-${item.id}`}
          />
        ))}
      </View>
    </View>
  );
}
