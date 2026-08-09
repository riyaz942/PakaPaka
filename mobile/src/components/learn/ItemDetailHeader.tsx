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

/**
 * The detail hero's own scale. The spec draws 76px for a single kanji and 66px
 * for a word; grammar patterns run several tokens wide and step down again.
 */
export const DETAIL_HERO_FONT_SIZE = {
  glyph: { fontSize: 76, lineHeight: 84 },
  word: { fontSize: 66, lineHeight: 76 },
  pattern: { fontSize: 34, lineHeight: 44 },
} as const;

/**
 * The spec sets the hero face at 500 for large heroes and 700 for small tiles.
 * It never draws a 500 below 66px nor a 700 above 38px, so the break goes in
 * that gap — 64px keeps the placement card's hero on the light face. Callers
 * whose variant is fixed name the weight class directly; this is for the ones
 * that pick a size at runtime.
 */
export function heroWeightClass({ fontSize }: { fontSize: number }) {
  return fontSize >= 64 ? 'font-jp-hero' : 'font-jp-hero-bold';
}

type ItemDetailHeaderProps = {
  itemType: ItemType;
  meaning: string;
  /** The rendered primary form (character/word/pattern), colored by the caller. */
  children: ReactNode;
  size?: HeroSize;
  /**
   * Names the type on a pill inside the card. The detail screens turn this off:
   * their header bar already carries the badge, so a second one would repeat it.
   */
  showTypeBadge?: boolean;
  testID?: string;
};

/**
 * The type-soft hero card every item page and lesson card opens with: the form
 * heroed in the type's deep tone, its meaning underneath. Extra-large radius
 * (r-xl) marks it as the page's subject rather than one card among many.
 */
export function ItemDetailHeader({
  itemType,
  meaning,
  children,
  size = 'md',
  showTypeBadge = true,
  testID,
}: ItemDetailHeaderProps) {
  const accent = CONTENT_TYPE_ACCENT[itemType];
  return (
    <View
      testID={testID}
      className={cn(
        'items-center gap-space-sm rounded-radius-xl',
        size === 'lg' ? 'p-space-xl' : 'p-space-lg',
        accent.soft,
      )}>
      {/* On the soft hero fill the badge's own soft background disappears, so
          it takes the spec's translucent plate instead — white over the pastel
          in light, the dark surface over the tint in dark. */}
      {showTypeBadge ? (
        <ContentTypeBadge itemType={itemType} className="bg-surface/70" />
      ) : null}
      {children}
      <Text
        className={cn(
          'text-center font-ui-extrabold',
          size === 'lg' ? 'text-title-lg' : 'text-title',
          accent.deep,
        )}>
        {meaning}
      </Text>
    </View>
  );
}
