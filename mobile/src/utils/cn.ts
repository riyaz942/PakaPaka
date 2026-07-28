import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The UX-DR3 font-size scale (tailwind.config.js `fontSize`). tailwind-merge does
 * not know our custom scale, so without this it cannot tell a `text-*` font size
 * from a `text-*` color: `cn('text-primary', 'text-title')` collapsed to
 * `text-title` and dropped the color, leaving the platform default (black) —
 * invisible on the dark palette. Registering the scale keeps one color and one
 * size while still collapsing genuine same-group conflicts.
 */
const FONT_SIZE_TOKENS = [
  'display',
  'title-lg',
  'title',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'overline',
  'furigana',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZE_TOKENS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
