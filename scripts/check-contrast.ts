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

/**
 * Palette tokens are space-separated sRGB channels (`26 26 46`), not hex, so that
 * `tailwind.config.js` can wrap them as `rgb(var(--token) / <alpha-value>)`.
 */
const CSS_VAR = /--color-([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/g;

function channelsToHex(r: string, g: string, b: string): string {
  return `#${[r, g, b]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

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
  const lightBlock = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? '';
  const lightPalette: Palette = {};
  for (const match of lightBlock.matchAll(CSS_VAR)) {
    lightPalette[match[1]] = channelsToHex(match[2], match[3], match[4]);
  }

  if (Object.keys(lightPalette).length === 0) {
    throw new Error(
      'No --color-* tokens parsed from global.css — the palette format changed and this gate is checking nothing.',
    );
  }

  if (theme === 'light') {
    return lightPalette;
  }

  const darkBlock =
    css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*:root\s*\{([^}]+)\}/)?.[1] ?? '';
  const darkPalette: Palette = { ...lightPalette };
  for (const match of darkBlock.matchAll(CSS_VAR)) {
    darkPalette[match[1]] = channelsToHex(match[2], match[3], match[4]);
  }
  return darkPalette;
}

export function buildPalettes(
  globalCss = fs.readFileSync(GLOBAL_CSS_PATH, 'utf8'),
): Record<ThemeName, Palette> {
  return {
    dark: parseCssPalette(globalCss, 'dark'),
    light: parseCssPalette(globalCss, 'light'),
  };
}

/** Content and feedback families both split into base / soft / deep roles. */
const CONTENT_TYPES = ['radical', 'kanji', 'vocabulary', 'grammar', 'passage'] as const;
const FEEDBACK_TYPES = ['correct', 'incorrect', 'warning', 'info'] as const;

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
        {
          name: `faint on ${bg}`,
          foreground: 'faint',
          background: bg,
          textClass: 'exempt',
          theme,
          rationale: 'Design System v2 restricts faint to captions and decoration — never body text',
        },
      );
    }

    // Feedback base carries icons, 1.5px state borders and fills — non-text under
    // WCAG 1.4.11. The readable copy in each state uses the `-deep` step below.
    for (const feedback of FEEDBACK_TYPES) {
      for (const bg of surfaceTokens) {
        pairs.push({
          name: `feedback-${feedback} icon/border on ${bg}`,
          foreground: `feedback-${feedback}`,
          background: bg,
          textClass: 'non-text-ui',
          theme,
        });
      }

      pairs.push({
        name: `feedback-${feedback}-deep on feedback-${feedback}-soft`,
        foreground: `feedback-${feedback}-deep`,
        background: `feedback-${feedback}-soft`,
        textClass: 'normal-text',
        theme,
      });

      // Verdict lines and nudges in the review session sit on the plain screen
      // background, not only on cards.
      for (const bg of surfaceTokens) {
        pairs.push({
          name: `feedback-${feedback}-deep on ${bg}`,
          foreground: `feedback-${feedback}-deep`,
          background: bg,
          textClass: 'normal-text',
          theme,
        });
      }
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

    // Stats sets the stage name in its stage hue. Apprentice/guru/master borrow
    // the matching content `-deep` step; enlightened has its own. The detail
    // header's stage pill puts that same step on the neutral fill it uses where
    // a stage has no content twin.
    pairs.push(
      {
        name: 'srs-enlightened-deep stage label on surface',
        foreground: 'srs-enlightened-deep',
        background: 'surface',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'srs-enlightened-deep stage pill on surface-elevated',
        foreground: 'srs-enlightened-deep',
        background: 'surface-elevated',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'srs-enlightened-deep stage kicker on background',
        foreground: 'srs-enlightened-deep',
        background: 'background',
        textClass: 'normal-text',
        theme,
      },
    );

    for (const content of CONTENT_TYPES) {
      for (const bg of surfaceTokens) {
        pairs.push({
          name: `content-${content} accent on ${bg}`,
          foreground: `content-${content}`,
          background: bg,
          textClass: 'large-text',
          theme,
        });
      }

      pairs.push({
        name: `content-${content}-deep on content-${content}-soft`,
        foreground: `content-${content}-deep`,
        background: `content-${content}-soft`,
        textClass: 'normal-text',
        theme,
      });

      // The `-deep` step also carries type-coloured copy on plain surfaces:
      // the review prompt kicker, the SRS stage kicker (which borrows its
      // stage's content twin), and Compare's per-item captions.
      for (const bg of surfaceTokens) {
        pairs.push({
          name: `content-${content}-deep text on ${bg}`,
          foreground: `content-${content}-deep`,
          background: bg,
          textClass: 'normal-text',
          theme,
        });
      }
    }

    for (const bg of surfaceTokens) {
      pairs.push({
        name: `goal ring arc on ${bg}`,
        foreground: 'ring',
        background: bg,
        textClass: 'non-text-ui',
        theme,
      });
    }

    for (const bg of surfaceTokens) {
      pairs.push(
        {
          name: `brand-text on ${bg}`,
          foreground: 'brand-text',
          background: bg,
          textClass: 'normal-text',
          theme,
        },
        {
          name: `brand-500 ring/border on ${bg}`,
          foreground: 'brand-500',
          background: bg,
          textClass: 'non-text-ui',
          theme,
        },
      );
    }

    pairs.push(
      {
        name: 'on-primary on brand-600',
        foreground: 'on-primary',
        background: 'brand-600',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'on-primary on feedback-incorrect-fill',
        foreground: 'on-primary',
        background: 'feedback-incorrect-fill',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'brand-800 on brand-50',
        foreground: 'brand-800',
        background: 'brand-50',
        textClass: 'normal-text',
        theme,
      },
      // The scheme-aware jade wash used for banners, selected choice cards and
      // the Home review card. `brand-50`/`brand-100` are fixed near-whites.
      {
        name: 'brand-text on brand-soft',
        foreground: 'brand-text',
        background: 'brand-soft',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'brand-text on brand-soft-strong',
        foreground: 'brand-text',
        background: 'brand-soft-strong',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'primary on brand-soft',
        foreground: 'primary',
        background: 'brand-soft',
        textClass: 'normal-text',
        theme,
      },
      {
        name: 'brand-soft on background',
        foreground: 'brand-soft',
        background: 'background',
        textClass: 'exempt',
        theme,
        rationale: 'Card fill, not a boundary — the 2px brand-500 border carries the edge',
      },
    );

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
