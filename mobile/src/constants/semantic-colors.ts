import { semanticColors as semanticColorsFromTokens } from '@/constants/design-tokens';

/** Semantic palette hex values — sourced from `design-tokens.js` (mirrors `global.css`). */
export const semanticColors = semanticColorsFromTokens;

export function getSemanticColors(scheme: 'light' | 'dark') {
  return semanticColors[scheme];
}
