import { router, type Href } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

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
  /**
   * A component the learner has not met and is not due to meet yet — 昨 on N5's
   * 昨日. It still links and still reads: the tile drops to the quiet `surface`
   * treatment and the section says so once underneath, rather than hiding it.
   */
  notYetLearned?: boolean;
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
 * status; a detail screen informs, it never withholds (FR76). A
 * `notYetLearned` component is marked, never dropped, for the same reason: the
 * character is in the word in front of the learner either way.
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
  const notYetLearned = items.filter((item) => item.notYetLearned);

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
        {items.map((item) => {
          const label = item.meaning
            ? `${item.primaryForm}, ${item.meaning}`
            : item.primaryForm;
          return (
            <LinkedItemTile
              key={item.id}
              itemType={item.itemType}
              form={item.primaryForm}
              meaning={item.meaning}
              // The layer-below tint says "a piece you already have". A
              // component taught later has not earned that yet, so it drops to
              // the quiet surface tile the "leads to" direction uses.
              variant={item.notYetLearned ? 'surface' : tileVariant}
              accessibilityRole="link"
              accessibilityLabel={item.notYetLearned ? `${label}, not learned yet` : label}
              onPress={() => router.push(hrefFor(item.id) as Href)}
              testID={testID ? `${testID}-${item.id}` : `cross-ref-${item.id}`}
            />
          );
        })}
      </View>
      {notYetLearned.length > 0 ? (
        <Text
          className="mt-space-sm text-caption text-muted"
          testID={testID ? `${testID}-not-yet-learned` : 'cross-ref-not-yet-learned'}>
          {notYetLearned.length === 1
            ? `You haven't learned ${notYetLearned[0].primaryForm} yet — it comes later in the course.`
            : `You haven't learned ${notYetLearned
                .map((item) => item.primaryForm)
                .join('、')} yet — they come later in the course.`}
        </Text>
      ) : null}
    </View>
  );
}
