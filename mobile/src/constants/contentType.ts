import type { ItemType } from '@/data/curriculum/itemRepository';

/**
 * Content-type accent colors (radical=blue, kanji=pink, vocabulary=purple,
 * grammar=gold, passage=slate). Sourced from the `content-*` NativeWind tokens
 * so light/dark WCAG-AA overrides in global.css stay authoritative. Use these
 * class bundles anywhere an item's type should read at a glance.
 *
 * Design System v2 splits each hue into three roles — see the plan's "Three-role
 * colors" decision: `glyph` for marks, `soft` for fills, `deep` for text on them.
 */
export type ContentAccent = {
  /** Left-side accent color, paired with `border-l-*` width (e.g. a list-row rule). */
  barLeft: string;
  /** Base hue as text — glyphs, icons and chip labels on a plain surface. */
  glyph: string;
  /** Base hue as a fill — the 5px list-row edge, stepper pills, dots. */
  edge: string;
  /** Tinted fill for hero cards, badges and callouts. */
  soft: string;
  /** Text that sits on `soft` — the only type colour that clears AA for copy. */
  deep: string;
};

/** Singular type name for per-item badges (ITEM_TYPE_LABELS is plural, for list headers). */
export const CONTENT_TYPE_LABEL: Record<ItemType, string> = {
  radical: 'Radical',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
};

/**
 * Reading passages are not curriculum `items`, but they share the Browse list
 * with them (FR63), so they need the same accent vocabulary. `content-passage`
 * is the passage accent per UX-DR32.
 */
export const PASSAGE_CONTENT_LABEL = 'Passage';

export const PASSAGE_CONTENT_ACCENT: ContentAccent = {
  barLeft: 'border-l-content-passage',
  glyph: 'text-content-passage',
  edge: 'bg-content-passage',
  soft: 'bg-content-passage-soft',
  deep: 'text-content-passage-deep',
};

export const CONTENT_TYPE_ACCENT: Record<ItemType, ContentAccent> = {
  radical: {
    barLeft: 'border-l-content-radical',
    glyph: 'text-content-radical',
    edge: 'bg-content-radical',
    soft: 'bg-content-radical-soft',
    deep: 'text-content-radical-deep',
  },
  kanji: {
    barLeft: 'border-l-content-kanji',
    glyph: 'text-content-kanji',
    edge: 'bg-content-kanji',
    soft: 'bg-content-kanji-soft',
    deep: 'text-content-kanji-deep',
  },
  vocabulary: {
    barLeft: 'border-l-content-vocabulary',
    glyph: 'text-content-vocabulary',
    edge: 'bg-content-vocabulary',
    soft: 'bg-content-vocabulary-soft',
    deep: 'text-content-vocabulary-deep',
  },
  grammar: {
    barLeft: 'border-l-content-grammar',
    glyph: 'text-content-grammar',
    edge: 'bg-content-grammar',
    soft: 'bg-content-grammar-soft',
    deep: 'text-content-grammar-deep',
  },
};
