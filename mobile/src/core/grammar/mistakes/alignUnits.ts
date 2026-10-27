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
const COST = { variant: 1, missing: 1, extra: 1, replaced: 1.5 };

type Candidate = {
  text: string;
  kind: StepKind;
  cost: number;
  variant?: UnitVariant;
};

/**
 * Cheapest way to read `input` (already normalized) as the answer's units, in order.
 * Ties prefer exact, allowed, variant, missing, extra, replaced. Every input character is consumed.
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

  const n = units.length;
  const m = input.length;
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
  best[n][m] = 0;

  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n && j === m) continue;
      const tryMove = (cost: number, next: Move) => {
        const total = cost + best[next.toUnit][next.toPos];
        if (total < best[i][j]) {
          best[i][j] = total;
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
          tryMove(COST.replaced, {
            kind: 'replaced',
            toUnit: i + 1,
            toPos: j + len,
          });
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
  return { steps, cost: best[0][0] };
}
