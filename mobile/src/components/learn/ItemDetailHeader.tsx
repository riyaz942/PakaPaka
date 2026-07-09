import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ContentTypeBadge } from '@/components/common/ContentTypeBadge';
import { CONTENT_TYPE_ACCENT } from '@/constants/contentType';
import type { ItemType } from '@/data/curriculum/itemRepository';
import { cn } from '@/utils/cn';

/**
 * Hero scale. `md` is the compact size used in the browse-list item detail;
 * `lg` is the roomier size used in the full-screen lesson teach card.
 */
export type HeroSize = 'md' | 'lg';

/**
 * Large-variant form sizes, applied as inline `fontSize` rather than a Tailwind
 * token: NativeWind compiles font-size tokens from tailwind.config at build time,
 * so a new token would need a full Metro restart to take effect. Inline styles
 * render immediately on reload.
 */
export const HERO_FONT_SIZE = {
  /** Single-glyph radical/kanji and short vocabulary. */
  glyph: { fontSize: 96, lineHeight: 104 },
  /** Longer words that would overflow at glyph size. */
  word: { fontSize: 52, lineHeight: 60 },
  /** Grammar patterns (monospace, often multi-token). */
  pattern: { fontSize: 40, lineHeight: 48 },
} as const;

type ItemDetailHeaderProps = {
  itemType: ItemType;
  meaning: string;
  /** The rendered primary form (character/word/pattern), colored by the caller. */
  children: ReactNode;
  size?: HeroSize;
  testID?: string;
};

/**
 * Centered, accent-tinted hero shown at the top of every learn/lesson item
 * card. Gives each content type an at-a-glance color identity while keeping the
 * reference sections below left-aligned for readability.
 */
export function ItemDetailHeader({
  itemType,
  meaning,
  children,
  size = 'md',
  testID,
}: ItemDetailHeaderProps) {
  const accent = CONTENT_TYPE_ACCENT[itemType];
  return (
    <View
      testID={testID}
      className={cn(
        'items-center gap-space-sm rounded-radius-lg',
        size === 'lg' ? 'p-space-xl' : 'p-space-lg',
        accent.tint,
      )}>
      <ContentTypeBadge itemType={itemType} />
      {children}
      <Text
        className={cn(
          'text-primary text-center',
          size === 'lg' ? 'text-title' : 'text-body-lg',
        )}>
        {meaning}
      </Text>
    </View>
  );
}
