import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

/**
 * `soft` tiles fill with the linked type's own tint — the spec uses them for the
 * parts an item is *made of* ("built from", "kanji in this word"), where the
 * layer below deserves its own colour block. `surface` tiles are the quieter
 * form for what an item leads *to* ("vocabulary using this kanji").
 */
export type LinkedItemTileVariant = 'surface' | 'soft';

type LinkedItemTileProps = {
  itemType: ItemType;
  /** Japanese form shown large, in the type's base hue. */
  form: string;
  /** English gloss under the form; omitted where the curriculum has none. */
  meaning?: string;
  variant?: LinkedItemTileVariant;
  onPress?: () => void;
  accessibilityRole?: 'button' | 'link';
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * The small tile that cross-links related items — "built from", "vocabulary
 * using this kanji", "used in these kanji". Japanese form on top, gloss beneath.
 */
export function LinkedItemTile({
  itemType,
  form,
  meaning,
  variant = 'surface',
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  testID,
}: LinkedItemTileProps) {
  const accent = CONTENT_TYPE_ACCENT[itemType];
  const isSoft = variant === 'soft';

  const content = (
    <>
      {/* 20px keeps the base-hue form on a plain surface inside WCAG's
          large-text allowance; the soft variant sits on its own tint and takes
          the deep step instead. */}
      <Text className={cn('text-title font-jp-bold', isSoft ? accent.deep : accent.glyph)}>
        {form}
      </Text>
      {meaning ? (
        <Text
          className={cn(
            'mt-[1px] text-caption font-ui-semibold',
            isSoft ? accent.deep : 'text-muted',
          )}>
          {meaning}
        </Text>
      ) : null}
    </>
  );

  const className = cn(
    'min-h-[44px] items-center justify-center rounded-radius-sm px-space-md py-space-sm',
    isSoft ? accent.soft : 'border border-border bg-surface',
  );

  if (!onPress) {
    return (
      <View testID={testID} className={className}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? (meaning ? `${form}, ${meaning}` : form)}
      onPress={onPress}
      testID={testID}
      className={className}>
      {content}
    </Pressable>
  );
}
