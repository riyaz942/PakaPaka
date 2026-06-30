import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.join(__dirname, '..');
const GLOBAL_CSS_PATH = path.join(REPO_ROOT, 'mobile', 'src', 'global.css');

export type TextClass = 'normal-text' | 'large-text' | 'non-text-ui' | 'exempt';

export type ThemeName = 'dark' | 'light';

export type ContrastPair = {
  name: string;
  foreground: string;
  background: string;
  textClass: TextClass;
  theme: ThemeName;
  rationale?: string;
};

export type Palette = Record<string, string>;

export type ContrastFailure = {
  pair: ContrastPair;
  ratio: number;
  required: number;
  foregroundHex: string;
  backgroundHex: string;
};

const THRESHOLDS: Record<Exclude<TextClass, 'exempt'>, number> = {
  'normal-text': 4.5,
  'large-text': 3,
  'non-text-ui': 3,
};

const CSS_VAR = /--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g;

/** WCAG 2.1 relative-luminance contrast ratio between two sRGB hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const lumA = relativeLuminance(foreground);
  const lumB = relativeLuminance(background);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function parseCssPalette(css: string, theme: ThemeName): Palette {
  const darkBlock = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
  const darkPalette: Palette = {};
  for (const match of darkBlock.matchAll(CSS_VAR)) {
    darkPalette[match[1]] = match[2].toLowerCase();
  }

  if (theme === 'dark') {
    return darkPalette;
  }

  const lightBlock =
    css.match(/@media\s*\(prefers-color-scheme:\s*light\)\s*\{[^}]*:root\s*\{([^}]+)\}/)?.[1] ??
    '';
  const lightPalette: Palette = { ...darkPalette };
  for (const match of lightBlock.matchAll(CSS_VAR)) {
    lightPalette[match[1]] = match[2].toLowerCase();
  }
  return lightPalette;
}

export function buildPalettes(
  globalCss = fs.readFileSync(GLOBAL_CSS_PATH, 'utf8'),
): Record<ThemeName, Palette> {
  return {
    dark: parseCssPalette(globalCss, 'dark'),
    light: parseCssPalette(globalCss, 'light'),
  };
}

/** Pairing manifest — single source for which token pairs must meet WCAG AA. */
export function contrastPairManifest(): ContrastPair[] {
  const surfaceTokens = ['background', 'surface'] as const;
  const themes: ThemeName[] = ['dark', 'light'];

  const pairs: ContrastPair[] = [];

  for (const theme of themes) {
    for (const bg of surfaceTokens) {
      pairs.push(
        { name: `primary on ${bg}`, foreground: 'primary', background: bg, textClass: 'normal-text', theme },
        { name: `secondary on ${bg}`, foreground: 'secondary', background: bg, textClass: 'normal-text', theme },
        {
          name: `muted on ${bg}`,
          foreground: 'muted',
          background: bg,
          textClass: 'exempt',
          theme,
          rationale: 'Decorative/disabled copy only — not used for meaningful body text',
        },
      );
    }

    for (const feedback of [
      'feedback-correct',
      'feedback-incorrect',
      'feedback-warning',
      'feedback-info',
    ] as const) {
      pairs.push({
        name: `${feedback} on surface`,
        foreground: feedback,
        background: 'surface',
        textClass: 'normal-text',
        theme,
      });
    }

    for (const srs of [
      'srs-apprentice',
      'srs-guru',
      'srs-master',
      'srs-enlightened',
      'srs-burned',
    ] as const) {
      pairs.push({
        name: `${srs} pill on surface`,
        foreground: srs,
        background: 'surface',
        textClass: 'large-text',
        theme,
      });
    }

    for (const content of [
      'content-radical',
      'content-kanji',
      'content-vocabulary',
      'content-grammar',
      'content-reading',
    ] as const) {
      for (const bg of surfaceTokens) {
        pairs.push({
          name: `${content} accent on ${bg}`,
          foreground: content,
          background: bg,
          textClass: 'large-text',
          theme,
        });
      }
    }

    for (const ring of ['ring-start', 'ring-mid', 'ring-end', 'ring-complete'] as const) {
      for (const bg of surfaceTokens) {
        pairs.push({
          name: `${ring} ring state on ${bg}`,
          foreground: ring,
          background: bg,
          textClass: 'non-text-ui',
          theme,
        });
      }
    }

    pairs.push({
      name: 'reinforcement-text on reinforcement-bg',
      foreground: 'reinforcement-text',
      background: 'reinforcement-bg',
      textClass: 'normal-text',
      theme,
    });

    pairs.push({
      name: 'border on surface',
      foreground: 'border',
      background: 'surface',
      textClass: 'exempt',
      theme,
      rationale: 'Non-text UI border — WCAG 1.4.11 decorative separator',
    });
  }

  return pairs;
}

export function resolvePairColors(pair: ContrastPair, palettes: Record<ThemeName, Palette>): {
  foregroundHex: string;
  backgroundHex: string;
} | null {
  const palette = palettes[pair.theme];
  const foregroundHex = palette[pair.foreground];
  const backgroundHex = palette[pair.background];
  if (!foregroundHex || !backgroundHex) {
    return null;
  }
  return { foregroundHex, backgroundHex };
}

export function checkContrastPairs(
  palettes: Record<ThemeName, Palette>,
  pairs: ContrastPair[] = contrastPairManifest(),
): { ok: true } | { ok: false; failures: ContrastFailure[]; missing: string[] } {
  const failures: ContrastFailure[] = [];
  const missing: string[] = [];

  for (const pair of pairs) {
    const colors = resolvePairColors(pair, palettes);
    if (!colors) {
      missing.push(
        `${pair.theme} ${pair.name}: missing token ${pair.foreground} or ${pair.background}`,
      );
      continue;
    }

    if (pair.textClass === 'exempt') {
      if (!pair.rationale || pair.rationale.trim().length === 0) {
        missing.push(`${pair.theme} ${pair.name}: exempt classification requires rationale`);
      }
      continue;
    }

    const ratio = contrastRatio(colors.foregroundHex, colors.backgroundHex);
    const required = THRESHOLDS[pair.textClass];
    if (ratio < required) {
      failures.push({
        pair,
        ratio,
        required,
        foregroundHex: colors.foregroundHex,
        backgroundHex: colors.backgroundHex,
      });
    }
  }

  if (missing.length > 0 || failures.length > 0) {
    return { ok: false, failures, missing };
  }
  return { ok: true };
}

export function formatFailure(failure: ContrastFailure): string {
  const { pair, ratio, required, foregroundHex, backgroundHex } = failure;
  return `${pair.theme} ${pair.name}: ${foregroundHex} on ${backgroundHex} = ${ratio.toFixed(1)}:1 (needs ${required}:1, ${pair.textClass})`;
}

function main(): void {
  const palettes = buildPalettes();
  const pairs = contrastPairManifest();
  const result = checkContrastPairs(palettes, pairs);

  if (!result.ok) {
    for (const message of result.missing) {
      console.error(`MISSING ${message}`);
    }
    for (const failure of result.failures) {
      console.error(formatFailure(failure));
    }
    process.exit(1);
  }

  console.log(`Checked ${pairs.length} token contrast pair(s) across dark and light palettes — all pass.`);
}

if (process.argv[1]?.includes('check-contrast')) {
  main();
}
