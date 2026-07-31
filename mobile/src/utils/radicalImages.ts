// GENERATED FILE — do not edit by hand.
// Run `npm run generate-radical-assets` after adding or removing art under
// `assets/radicals/`. See docs/content/radical-mnemonic-images.md.

import type { ImageSourcePropType } from 'react-native';

/**
 * Radical mnemonic art bundled into the app binary, keyed by the value the
 * curriculum stores in `visual_mnemonic_url` (`radicals/{level}/{slug}.webp`).
 * There is no remote image host, so a key missing here means that radical's art
 * has not been drawn yet and the caller renders the mnemonic text instead.
 */
const RADICAL_IMAGES: Record<string, ImageSourcePropType> = {
  'radicals/n5/bou.webp': require('../../assets/radicals/n5/bou.webp'),
  'radicals/n5/chikara.webp': require('../../assets/radicals/n5/chikara.webp'),
  'radicals/n5/hito.webp': require('../../assets/radicals/n5/hito.webp'),
  'radicals/n5/hitoashi.webp': require('../../assets/radicals/n5/hitoashi.webp'),
  'radicals/n5/hitoyane.webp': require('../../assets/radicals/n5/hitoyane.webp'),
  'radicals/n5/ichi.webp': require('../../assets/radicals/n5/ichi.webp'),
  'radicals/n5/ki.webp': require('../../assets/radicals/n5/ki.webp'),
  'radicals/n5/ni.webp': require('../../assets/radicals/n5/ni.webp'),
  'radicals/n5/ninben.webp': require('../../assets/radicals/n5/ninben.webp'),
  'radicals/n5/san.webp': require('../../assets/radicals/n5/san.webp'),
  'radicals/n5/sanzui.webp': require('../../assets/radicals/n5/sanzui.webp'),
  'radicals/n5/ten.webp': require('../../assets/radicals/n5/ten.webp'),
};

export function getRadicalImage(ref: string | null | undefined): ImageSourcePropType | undefined {
  const key = ref?.trim();
  return key ? RADICAL_IMAGES[key] : undefined;
}
