import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the Design System v2 "three-role colors" rule at the call site.
 *
 * `npm run check-contrast` validates the *palette* — it proves `content-kanji`
 * clears 3:1 as a mark and `content-kanji-deep` clears 4.5:1 as copy. It cannot
 * see which one a component actually reached for, so a `<Text>` set in the base
 * hue passes CI while failing AA on screen. That is how ~13 of them survived to
 * Session 8 of the restyle.
 *
 * The rule: `base` is for glyphs, icons, dots, edges and 1.5px borders; `-soft`
 * is a fill; `-deep` is text. A base hue may only reach a `Text` when the mark
 * is large enough for WCAG's 3:1 non-text/large-text threshold.
 *
 * Anything below is an accepted exception with its reason. New entries need a
 * reason too — if you cannot write one, the call site wants `-deep`.
 */
const ALLOWED: Record<string, string> = {
  'src/components/stats/WeaknessStatCard.tsx':
    'Icon colour on a matching -soft fill — a mark, not copy.',
  'src/app/onboarding/complete.tsx':
    'Icon colour inside the value-prop soft tiles — a mark, not copy.',
  'src/components/learn/LearnItemRow.tsx':
    'Heroed 40px list glyph; large-text threshold is 3:1, which every content base clears.',
};

const BASE_HUE =
  /\btext-(?:content-(?:radical|kanji|vocabulary|grammar|passage)|feedback-(?:correct|incorrect|warning|info))(?![\w-])/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('content and feedback base hues', () => {
  const srcRoot = path.join(__dirname, '..');

  it('are never used as text outside the documented exceptions', () => {
    const offenders: string[] = [];

    for (const file of walk(srcRoot)) {
      const relative = path.relative(path.join(srcRoot, '..'), file);
      if (ALLOWED[relative]) {
        continue;
      }
      for (const [index, line] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
        // Skip prose: several components explain the rule in a comment.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) {
          continue;
        }
        // `Icon` takes a colour class to drive `currentColor` on the SVG, so a
        // base hue there is a mark by definition — exactly its documented role.
        if (line.includes('<Icon ')) {
          continue;
        }
        if (BASE_HUE.test(line)) {
          offenders.push(`${relative}:${index + 1} — ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('lists a reason for every exception', () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(fs.existsSync(path.join(srcRoot, '..', file))).toBe(true);
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});
