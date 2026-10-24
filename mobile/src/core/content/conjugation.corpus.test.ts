import fs from 'node:fs';
import path from 'node:path';

import { conjugate, parseConjugationClass } from './conjugation';

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;
const VOCABULARY_DIR = path.join(__dirname, '../../../../curriculum/vocabulary');

type WordSpan = { vocabulary_slug: string; start: number; end: number; inflection?: string };
type VocabItem = {
  slug: string;
  primary_form: string;
  furigana?: string;
  conjugation_class?: string;
  example_sentences?: { japanese: string; word_spans?: WordSpan[] }[];
};

const items: VocabItem[] = LEVELS.flatMap(
  (level) =>
    JSON.parse(fs.readFileSync(path.join(VOCABULARY_DIR, `${level}.json`), 'utf8')).items as VocabItem[],
);
const classed = items.filter((item) => item.conjugation_class);

describe('conjugator over the compiled vocabulary', () => {
  it('every classed word conjugates', () => {
    const failures = classed
      .filter((item) => {
        const cls = parseConjugationClass(item.conjugation_class);
        return (
          !cls ||
          conjugate({ primaryForm: item.primary_form, furigana: item.furigana ?? null }, cls) === null
        );
      })
      .map((item) => `${item.slug}: ${item.primary_form} (${item.conjugation_class})`);

    expect(failures).toEqual([]);
  });

  it('forms match the example sentences', () => {
    const mismatches: string[] = [];
    let checked = 0;

    for (const item of classed) {
      const cls = parseConjugationClass(item.conjugation_class);
      const table = cls
        ? conjugate({ primaryForm: item.primary_form, furigana: item.furigana ?? null }, cls)
        : null;
      if (!table) continue;

      for (const sentence of item.example_sentences ?? []) {
        for (const span of sentence.word_spans ?? []) {
          if (span.vocabulary_slug !== item.slug) continue;
          const text = sentence.japanese.slice(span.start, span.end);

          if (span.inflection === 'ta') {
            checked += 1;
            if (text !== table.plainPast.surface) {
              mismatches.push(`${item.slug}: ${text} → ${table.plainPast.surface}`);
            }
          } else if (span.inflection === 'masu') {
            checked += 1;
            const polite = [table.polite, table.politeNegative, table.politePast, table.politePastNegative];
            if (!polite.some((cell) => cell.surface === text)) {
              mismatches.push(`${item.slug}: ${text} → ${polite.map((cell) => cell.surface).join(' / ')}`);
            }
          } else if (span.inflection === 'nai') {
            checked += 1;
            const stem = table.plainNegative.surface.replace(/い$/, '');
            if (!text.startsWith(stem)) {
              mismatches.push(`${item.slug}: ${text} → ${stem}…`);
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});
