import {
  buildPalettes,
  checkContrastPairs,
  contrastPairManifest,
  contrastRatio,
  formatFailure,
  type ContrastPair,
} from './check-contrast';

describe('check-contrast', () => {
  it('computes WCAG reference contrast for white on black', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('computes a mid-range pair within expected bounds', () => {
    const ratio = contrastRatio('#767676', '#ffffff');
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(5);
  });

  it('covers every manifest pair with resolvable palette tokens', () => {
    const palettes = buildPalettes();
    const pairs = contrastPairManifest();
    const result = checkContrastPairs(palettes, pairs);
    expect(result.ok).toBe(true);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('classifies every manifest entry as normal, large, non-text-ui, or exempt', () => {
    for (const pair of contrastPairManifest()) {
      expect(['normal-text', 'large-text', 'non-text-ui', 'exempt']).toContain(pair.textClass);
    }
  });

  it('includes the goal ring arc in the manifest, in both themes', () => {
    const pairs = contrastPairManifest();
    for (const theme of ['light', 'dark'] as const) {
      expect(
        pairs.some(
          (pair) =>
            pair.foreground === 'ring' &&
            pair.theme === theme &&
            pair.textClass === 'non-text-ui',
        ),
      ).toBe(true);
    }
  });

  it('fails on a deliberately low-contrast synthetic pair', () => {
    const palettes = buildPalettes();
    const failingPair: ContrastPair = {
      name: 'synthetic fail',
      foreground: 'primary',
      background: 'background',
      textClass: 'normal-text',
      theme: 'dark',
    };

    palettes.dark.primary = '#cccccc';
    palettes.dark.background = '#dddddd';

    const result = checkContrastPairs(palettes, [failingPair]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures).toHaveLength(1);
      expect(formatFailure(result.failures[0])).toMatch(/needs 4\.5:1/);
    }
  });

  it('passes on the real project palette', () => {
    const result = checkContrastPairs(buildPalettes());
    if (!result.ok) {
      const messages = [
        ...result.missing,
        ...result.failures.map(formatFailure),
      ];
      throw new Error(messages.join('\n'));
    }
    expect(result.ok).toBe(true);
  });

  it('fails when an exempt pair is missing rationale', () => {
    const result = checkContrastPairs(buildPalettes(), [
      {
        name: 'missing exemption rationale',
        foreground: 'muted',
        background: 'surface',
        textClass: 'exempt',
        theme: 'dark',
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing[0]).toMatch(/requires rationale/);
    }
  });
});
