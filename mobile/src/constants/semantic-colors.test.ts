import fs from 'node:fs';
import path from 'node:path';

import { semanticColors } from './semantic-colors';

const GLOBAL_CSS = fs.readFileSync(path.join(__dirname, '..', 'global.css'), 'utf8');

/** `semanticColors` is a hand-maintained hex mirror of the channel triplets in
 *  global.css — parse the real thing so the two cannot drift apart silently. */
function paletteFromCss(scheme: 'light' | 'dark'): Record<string, string> {
  const light = /:root\s*\{([^}]+)\}/.exec(GLOBAL_CSS)?.[1] ?? '';
  const dark =
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*:root\s*\{([^}]+)\}/.exec(GLOBAL_CSS)?.[1] ??
    '';
  const palette: Record<string, string> = {};
  for (const block of scheme === 'light' ? [light] : [light, dark]) {
    for (const [, name, r, g, b] of block.matchAll(
      /--color-([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/g,
    )) {
      palette[name] = `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return palette;
}

/** Mirror key → global.css token name. */
const TOKEN_FOR_KEY = {
  background: 'background',
  surface: 'surface',
  surfaceElevated: 'surface-elevated',
  border: 'border',
  primary: 'primary',
  secondary: 'secondary',
  muted: 'muted',
  faint: 'faint',
  onPrimary: 'on-primary',
  brand: 'brand-500',
  brandFill: 'brand-600',
  brandText: 'brand-text',
  feedbackInfo: 'feedback-info',
} as const;

describe('semanticColors', () => {
  it.each(['dark', 'light'] as const)('matches global.css for %s scheme', (scheme) => {
    const palette = paletteFromCss(scheme);
    const expected = Object.fromEntries(
      Object.entries(TOKEN_FOR_KEY).map(([key, token]) => [key, palette[token]]),
    );

    expect(semanticColors[scheme]).toEqual(expected);
  });

  it('covers every key the mirror declares', () => {
    expect(Object.keys(semanticColors.light).sort()).toEqual(Object.keys(TOKEN_FOR_KEY).sort());
  });
});
