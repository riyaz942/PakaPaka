import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

type LinkedItemTileProps = {
  itemType: ItemType;
  /** Japanese form shown large, in the type's base hue. */
  form: string;
  /** English gloss under the form. */
  meaning: string;
  onPress?: () => void;
  testID?: string;
};

/**
 * The small tile that cross-links related items — "built from", "vocabulary
 * using this kanji", "used in these kanji". Surface-elevated chip, Japanese form
 * in the type hue, gloss beneath.
 */
export function LinkedItemTile({
  itemType,
  form,
  meaning,
  onPress,
  testID,
}: LinkedItemTileProps) {
  const accent = CONTENT_TYPE_ACCENT[itemType];
  const content = (
    <>
      <Text className={cn('text-title font-jp-bold', accent.glyph)}>{form}</Text>
      <Text className="mt-[2px] text-caption font-ui-semibold text-muted">{meaning}</Text>
    </>
  );

  const className =
    'min-h-[44px] items-center rounded-radius-md border border-border bg-surface-elevated px-space-md py-space-sm';

  if (!onPress) {
    return (
      <View testID={testID} className={className}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${form}, ${meaning}`}
      onPress={onPress}
      testID={testID}
      className={className}>
      {content}
    </Pressable>
  );
}
