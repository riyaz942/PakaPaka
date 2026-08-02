import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../../tailwind.config.js');

const GLOBAL_CSS = fs.readFileSync(path.join(__dirname, '..', 'global.css'), 'utf8');

const colors: Record<string, string> = tailwindConfig.theme.extend.colors;

/**
 * Tailwind cannot apply an opacity modifier to a bare `var()` color — it emits no
 * rule at all, so `bg-content-kanji/15` rendered nothing while looking correct in
 * source. The palette therefore stores sRGB channel triplets and the config wraps
 * them in `rgb(... / <alpha-value>)`. These two checks keep the halves in step.
 */
describe('palette alpha support', () => {
  const varColors = Object.entries(colors).filter(([, value]) => value.includes('var(--color-'));

  it('covers every CSS-variable color token', () => {
    expect(varColors.length).toBeGreaterThan(20);
  });

  it.each(varColors)('%s is wrapped so opacity modifiers compile', (_name, value) => {
    expect(value).toMatch(/^rgb\(var\(--color-[a-z0-9-]+\) \/ <alpha-value>\)$/);
  });

  it('declares every global.css color as sRGB channels, not hex', () => {
    const hexTokens = [...GLOBAL_CSS.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-fA-F]+)/g)].map(
      (match) => `${match[1]}: ${match[2]}`,
    );
    expect(hexTokens).toEqual([]);
  });

  it('backs every wrapped token with a declared variable', () => {
    const declared = new Set(
      [...GLOBAL_CSS.matchAll(/(--color-[a-z0-9-]+):\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}/g)].map(
        (match) => match[1],
      ),
    );

    const missing = varColors
      .map(([, value]) => /var\((--color-[a-z0-9-]+)\)/.exec(value)?.[1])
      .filter((name) => name && !declared.has(name));

    expect(missing).toEqual([]);
  });
});
