import { levenshtein } from '@/core/answer/levenshtein';
import { normalizeBuildText } from '@/core/grammar/buildEvaluator';

import type {
  Alignment,
  AlignStep,
  AnswerUnit,
  DiagnosisWord,
  StepKind,
  UnitVariant,
} from './mistake.types';
import { unitVariants } from './unitVariants';

const MAX_SLICE = 8;
const KANJI = /[\u3400-\u9fff々]/;
const KANJI_ALL = /[\u3400-\u9fff々]/g;
/** Shorter words need an exact match, like a kana reading answer (readingEvaluator). */
const MIN_TYPO_LENGTH = 3;
export const COST = { variant: 1, missing: 1, extra: 1, replaced: 1.5 };

type Candidate = {
  text: string;
  kind: StepKind;
  cost: number;
  variant?: UnitVariant;
};

/** One kana added, dropped or changed (たべまう for たべます); any kanji stay the same. */
function isTypo(slice: string, target: string): boolean {
  const kanji = (text: string) => (text.match(KANJI_ALL) ?? []).join('');
  return kanji(slice) === kanji(target) && levenshtein(slice, target) === 1;
}

/**
 * Cheapest way to read `input` (already normalized) as the answer's units, in order.
 * Equal costs prefer fewer missing units, then exact, allowed, variant, missing, extra, replaced.
 * Every input character is consumed.
 */
export function alignUnits(
  input: string,
  units: AnswerUnit[],
  words: Record<string, DiagnosisWord>,
  allowed: Record<number, string[]> = {},
): Alignment {
  const candidates: Candidate[][] = units.map((unit, i) => {
    const list: Candidate[] = [];
    for (const raw of [unit.surface, unit.reading]) {
      const text = normalizeBuildText(raw);
      if (text) list.push({ text, kind: 'exact', cost: 0 });
    }
    for (const text of allowed[i] ?? []) list.push({ text, kind: 'allowed', cost: 0 });
    const word = unit.itemId ? (words[unit.itemId] ?? null) : null;
    for (const variant of unitVariants(unit, word)) {
      list.push({
        text: variant.text,
        kind: variant.kind,
        cost: COST.variant,
        variant,
      });
    }
    return list;
  });

  // A word's own spellings that a one-kana typo can be read against. Not particles or
  // grammar text: one kana off there is a different particle or grammar, not a typo.
  const typoTargets: string[][] = units.map((unit, i) =>
    unit.role === 'word' && !unit.inGrammar
      ? candidates[i]
          .filter((c) => c.kind === 'exact' && c.text.length >= MIN_TYPO_LENGTH)
          .map((c) => c.text)
      : [],
  );

  const n = units.length;
  const m = input.length;
  // A kana spelling of a kanji unit right after a kanji: likely the tail of another word.
  const kanjiUnit = units.map((unit) => KANJI.test(unit.surface));
  const readingAfterKanji = (i: number, text: string, at: number) =>
    kanjiUnit[i] && !KANJI.test(text) && at > 0 && KANJI.test(input[at - 1]);
  // best[i][j] = cheapest cost of units i.. against input j..; move[i][j] says how to get it.
  type Move = {
    kind: StepKind;
    toUnit: number;
    toPos: number;
    variant?: UnitVariant;
  };
  const best: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  const move: (Move | undefined)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1));
  // misses[i][j] = missing units on that cheapest path (tie-break).
  const misses: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  best[n][m] = 0;

  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n && j === m) continue;
      const tryMove = (cost: number, next: Move) => {
        const total = cost + best[next.toUnit][next.toPos];
        const missed = misses[next.toUnit][next.toPos] + (next.kind === 'missing' ? 1 : 0);
        if (total < best[i][j] || (total === best[i][j] && missed < misses[i][j])) {
          best[i][j] = total;
          misses[i][j] = missed;
          move[i][j] = next;
        }
      };
      if (i < n) {
        for (const c of candidates[i]) {
          if (input.startsWith(c.text, j)) {
            tryMove(c.cost, {
              kind: c.kind,
              toUnit: i + 1,
              toPos: j + c.text.length,
              variant: c.variant,
            });
          }
        }
        tryMove(COST.missing, { kind: 'missing', toUnit: i + 1, toPos: j });
      }
      for (let len = 1; len <= MAX_SLICE && j + len <= m; len++) {
        tryMove(COST.extra, { kind: 'extra', toUnit: i, toPos: j + len });
      }
      if (i < n) {
        for (let len = 1; len <= MAX_SLICE && j + len <= m; len++) {
          // Unknown text only: a slice that starts or ends with the unit's known text is
          // that text plus extra (に電話しました = extra に + form 電話しました).
          const slice = input.slice(j, j + len);
          const known = candidates[i].some(
            (c) =>
              c.text && c.text.length < len && (slice.startsWith(c.text) || slice.endsWith(c.text)),
          );
          if (known) continue;
          tryMove(COST.replaced, {
            kind: 'replaced',
            toUnit: i + 1,
            toPos: j + len,
          });
        }
        for (const target of typoTargets[i]) {
          for (let len = target.length - 1; len <= target.length + 1 && j + len <= m; len++) {
            const slice = input.slice(j, j + len);
            if (!isTypo(slice, target)) continue;
            tryMove(COST.variant, {
              kind: 'spelling_typo',
              toUnit: i + 1,
              toPos: j + len,
              variant: { text: slice, kind: 'spelling_typo' },
            });
          }
        }
      }
    }
  }

  const steps: AlignStep[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const step = move[i][j] as Move;
    steps.push({
      kind: step.kind,
      unitIndex: step.kind === 'extra' ? null : i,
      from: j,
      to: step.toPos,
      ...(step.variant && { variant: step.variant }),
    });
    i = step.toUnit;
    j = step.toPos;
  }

  // One extra kanji, then a kana spelling of a kanji unit: one replaced word (読みます).
  // A longer kanji run (毎日) is a word of its own and stays extra.
  let cost = best[0][0];
  for (let k = steps.length - 1; k > 0; k--) {
    const [extra, step] = [steps[k - 1], steps[k]];
    if (extra.kind !== 'extra' || step.unitIndex === null) continue;
    if (step.kind === 'missing' || step.kind === 'replaced') continue;
    if (!readingAfterKanji(step.unitIndex, input.slice(step.from, step.to), step.from)) continue;
    const stem = step.from - 1;
    if (stem > extra.from && KANJI.test(input[stem - 1])) continue;
    const replaced: AlignStep = {
      kind: 'replaced',
      unitIndex: step.unitIndex,
      from: stem,
      to: step.to,
    };
    cost +=
      COST.replaced - (step.variant ? COST.variant : 0) - (stem > extra.from ? 0 : COST.extra);
    if (stem > extra.from) steps.splice(k - 1, 2, { ...extra, to: stem }, replaced);
    else steps.splice(k - 1, 2, replaced);
  }
  return { steps, cost };
}
