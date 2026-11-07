/**
 * Layout constants shared across screens. Colour and type live in NativeWind
 * tokens (`global.css` / `tailwind.config.js`); do not reintroduce a parallel
 * palette here.
 */

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;

/** Web only: the whole app sits in a centered frame no wider than this. */
export const MaxAppWidth = 1440;

/** Web only: at or above this window width, screens switch to their desktop layout. */
export const WideLayoutMinWidth = 1024;

/** Web only: widest a bottom sheet gets on a desktop window. */
export const MaxSheetWidth = 560;
