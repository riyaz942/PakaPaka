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
