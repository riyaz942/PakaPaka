import { DRAWN_GLYPH_PATHS } from '@/constants/drawnGlyphs';

/**
 * Zen Kaku Gothic New (`font-jp-hero*`) only covers the JIS repertoire. A
 * handful of rare radicals use Unicode Supplementary Plane characters (e.g.
 * 𢆉, U+22189) that fall outside it — Noto Sans JP (`font-jp*`) is a broader
 * bundled CJK font and covers most of the rest. The three that fall outside
 * Noto Sans JP too (checked against its cmap) have no font able to draw
 * them — Android's own CJK font shows an empty box — so `GlyphText` draws
 * them as SVG outlines (`DRAWN_GLYPH_PATHS`) and the font class is moot.
 */
const OUTSIDE_HERO_FONT = /[\u{10000}-\u{10FFFF}]/u;

function heroFontTier(text: string): 'hero' | 'noto' | 'drawn' {
  if (!OUTSIDE_HERO_FONT.test(text)) return 'hero';
  if (!(text in DRAWN_GLYPH_PATHS)) return 'noto';
  return 'drawn';
}

export function heroFontClassForWeight(text: string, weight: 'medium' | 'bold'): string {
  const tier = heroFontTier(text);
  if (tier === 'drawn') return '';
  if (tier === 'hero') return weight === 'bold' ? 'font-jp-hero-bold' : 'font-jp-hero';
  return weight === 'bold' ? 'font-jp-bold' : 'font-jp-medium';
}

/** Matches `heroWeightClass`'s fontSize threshold so it's a drop-in swap. */
export function heroFontClass(text: string, fontSize: number): string {
  return heroFontClassForWeight(text, fontSize < 64 ? 'bold' : 'medium');
}
