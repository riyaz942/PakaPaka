/**
 * Zen Kaku Gothic New (`font-jp-hero*`) only covers the JIS repertoire. A
 * handful of rare radicals use Unicode Supplementary Plane characters (e.g.
 * 𢆉, U+22189) that fall outside it — Noto Sans JP (`font-jp*`) is a broader
 * bundled CJK font and covers most of the rest. The three that fall outside
 * Noto Sans JP too (checked against its cmap) have no bundled font able to
 * draw them, so they fall through to the platform's own default font and
 * whatever CJK fallback it has.
 */
const OUTSIDE_HERO_FONT = /[\u{10000}-\u{10FFFF}]/u;
const OUTSIDE_NOTO_SANS_JP = new Set(['𢆉', '𬀷', '𠂇']);

function heroFontTier(text: string): 'hero' | 'noto' | 'system' {
  if (!OUTSIDE_HERO_FONT.test(text)) return 'hero';
  if (!OUTSIDE_NOTO_SANS_JP.has(text)) return 'noto';
  return 'system';
}

export function heroFontClassForWeight(text: string, weight: 'medium' | 'bold'): string {
  const tier = heroFontTier(text);
  if (tier === 'system') return '';
  if (tier === 'hero') return weight === 'bold' ? 'font-jp-hero-bold' : 'font-jp-hero';
  return weight === 'bold' ? 'font-jp-bold' : 'font-jp-medium';
}

/** Matches `heroWeightClass`'s fontSize threshold so it's a drop-in swap. */
export function heroFontClass(text: string, fontSize: number): string {
  return heroFontClassForWeight(text, fontSize < 64 ? 'bold' : 'medium');
}
