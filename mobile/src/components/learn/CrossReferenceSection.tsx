import { router, type Href } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import type { ExplainerTopic } from '@/components/learn/explainerContent';
import { useItemHref } from '@/components/learn/ItemLinkContext';

export type CrossReferenceChip = {
  id: string;
  primaryForm: string;
  meaning?: string;
};

type CrossReferenceSectionProps = {
  label: string;
  items: CrossReferenceChip[];
  infoTopic?: ExplainerTopic;
  testID?: string;
};

/**
 * Browsable chips for one cross-reference direction (FR72).
 *
 * Settled empty-state policy: an empty set renders nothing at all — no empty
 * "Related" shell. Every chip is always browsable regardless of lock or study
 * status; a detail screen informs, it never withholds (FR76).
 */
export function CrossReferenceSection({
  label,
  items,
  infoTopic,
  testID,
}: CrossReferenceSectionProps) {
  const hrefFor = useItemHref();

  if (items.length === 0) {
    return null;
  }

  return (
    <View className="mt-4" testID={testID}>
      <SectionHeading label={label} infoTopic={infoTopic} />
      <View className="mt-2 flex-row flex-wrap gap-2">
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="link"
            accessibilityLabel={
              item.meaning ? `${item.primaryForm}, ${item.meaning}` : item.primaryForm
            }
            onPress={() => router.push(hrefFor(item.id) as Href)}
            testID={testID ? `${testID}-${item.id}` : `cross-ref-${item.id}`}
            className="min-h-[44px] min-w-[44px] justify-center rounded-radius-md bg-surface px-3 py-2">
            <Text className="text-body text-feedback-info">{item.primaryForm}</Text>
            {item.meaning ? (
              <Text className="text-caption text-secondary">{item.meaning}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
