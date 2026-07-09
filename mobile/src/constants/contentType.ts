import type { ItemType } from '@/data/curriculum/itemRepository';

/**
 * Content-type accent colors (radical=blue, kanji=pink, vocabulary=green,
 * grammar=purple). Sourced from the `content-*` NativeWind tokens so light/dark
 * WCAG-AA overrides in global.css stay authoritative. Use these class bundles
 * anywhere an item's type should read at a glance (badges, list accents, headers).
 */
export type ContentAccent = {
  /** Accent text color for the form/character and labels. */
  text: string;
  /** Low-opacity tinted background for badges and hero headers. */
  tint: string;
  /** Left-side accent color, paired with `border-l-*` width (e.g. a list-row rule). */
  barLeft: string;
};

/** Singular type name for per-item badges (ITEM_TYPE_LABELS is plural, for list headers). */
export const CONTENT_TYPE_LABEL: Record<ItemType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
};

export const CONTENT_TYPE_ACCENT: Record<ItemType, ContentAccent> = {
  radical: {
    text: 'text-content-radical',
    tint: 'bg-content-radical/15',
    barLeft: 'border-l-content-radical',
  },
  kanji: {
    text: 'text-content-kanji',
    tint: 'bg-content-kanji/15',
    barLeft: 'border-l-content-kanji',
  },
  vocabulary: {
    text: 'text-content-vocabulary',
    tint: 'bg-content-vocabulary/15',
    barLeft: 'border-l-content-vocabulary',
  },
  grammar: {
    text: 'text-content-grammar',
    tint: 'bg-content-grammar/15',
    barLeft: 'border-l-content-grammar',
  },
};
