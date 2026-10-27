import { normalizeBuildText } from '@/core/grammar/buildEvaluator';
import type { GrammarSentenceCard } from '@/core/srs/srs.types';

import { alignUnits, COST } from './alignUnits';
import type {
  AlignStep,
  AnswerUnit,
  BuildDiagnosis,
  DiagnosisWord,
  FormDims,
  Mistake,
  MistakeKind,
  VariantKind,
} from './mistake.types';
import { normalizeWithMap } from './normalize';
import { formDims, PARTICLES, unitForm, unitVariants } from './unitVariants';

const MAX_MARKS = 3;

const isMatched = (step: AlignStep) => step.kind === 'exact' || step.kind === 'allowed';

/** At least half of the answer's non-particle units are matched (exact or allowed). */
function enoughMatched(steps: AlignStep[], units: AnswerUnit[]): boolean {
  const content = units.filter((unit) => unit.role !== 'particle').length;
  const matched = steps.filter(
    (step) =>
      step.unitIndex !== null && units[step.unitIndex].role !== 'particle' && isMatched(step),
  ).length;
  return matched * 2 >= content;
}

const sameDims = (a?: FormDims, b?: FormDims) =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/**
 * A saved answer as answer units: cut along the closest answer (within the limits), its own
 * text substituted where it differs, missing units left out. A substituted form keeps the word
 * and both spellings (勉強しました / べんきょうしました), so either script matches it.
 */
function savedAnswerUnits(
  saved: string,
  answers: AnswerUnit[][],
  words: Record<string, DiagnosisWord>,
): AnswerUnit[] | null {
  let best: { units: AnswerUnit[]; steps: AlignStep[]; cost: number } | null = null;
  for (const units of answers) {
    const { steps, cost } = alignUnits(saved, units, words);
    if (!best || cost < best.cost) best = { units, steps, cost };
  }
  if (!best || best.cost === 0) return null;
  const { units, steps } = best;
  const marks = steps.filter((step) => !isMatched(step)).length;
  if (marks > MAX_MARKS || !enoughMatched(steps, units)) return null;

  const derived: AnswerUnit[] = [];
  for (const step of steps) {
    const slice = saved.slice(step.from, step.to);
    const unit = step.unitIndex === null ? null : units[step.unitIndex];
    if (step.kind === 'missing') continue;
    if (unit && step.kind === 'exact') {
      derived.push(unit);
    } else if (unit?.itemId && step.kind === 'form') {
      const spellings = unitVariants(unit, words[unit.itemId] ?? null)
        .filter((v) => v.kind === 'form' && sameDims(v.dims, step.variant?.dims))
        .map((v) => v.text);
      derived.push({ ...unit, surface: spellings[0] ?? slice, reading: spellings[1] ?? slice });
    } else {
      const role = PARTICLES.includes(slice)
        ? 'particle'
        : unit && unit.role !== 'particle'
          ? unit.role
          : 'word';
      derived.push({
        surface: slice,
        reading: slice,
        role,
        itemId: null,
        inGrammar: unit?.inGrammar ?? false,
      });
    }
  }
  return derived.length > 0 ? derived : null;
}

/**
 * Whether `text` is the answer's chunks (a unit and the particles after it), each once,
 * in some order. Chunks keep particles on their word, so swapped particles are not word order.
 */
function isChunkConcatenation(text: string, units: AnswerUnit[]): boolean {
  const chunks: AnswerUnit[][] = [];
  for (const unit of units) {
    const isParticle =
      unit.role === 'particle' || PARTICLES.includes(normalizeBuildText(unit.surface));
    if (isParticle && chunks.length > 0) chunks[chunks.length - 1].push(unit);
    else chunks.push([unit]);
  }
  if (chunks.length === 0 || chunks.length > 30) return false; // bit mask below
  const ends = (chunk: AnswerUnit[], pos: number) =>
    chunk.reduce(
      (positions, unit) => {
        const spellings = [...new Set([unit.surface, unit.reading].map(normalizeBuildText))];
        return positions.flatMap((p) =>
          spellings.filter((s) => text.startsWith(s, p)).map((s) => p + s.length),
        );
      },
      [pos],
    );
  const all = 2 ** chunks.length - 1;
  const tried = new Set<string>();
  const search = (used: number, pos: number): boolean => {
    if (used === all) return pos === text.length;
    if (tried.has(`${used}:${pos}`)) return false;
    tried.add(`${used}:${pos}`);
    return chunks.some(
      (chunk, i) =>
        !(used & (1 << i)) && ends(chunk, pos).some((end) => search(used | (1 << i), end)),
    );
  };
  return search(0, 0);
}

/** The answer form's values on the dimensions where the learner's form differs. */
function answerDims(unit: AnswerUnit, word: DiagnosisWord | null, variant: FormDims) {
  const found = unitForm(unit, word);
  if (!found || found.form === 'te') return null;
  const values = formDims(found.form);
  return Object.fromEntries(
    Object.keys(variant).map((key) => [key, values[key as keyof FormDims]]),
  ) as FormDims;
}

function mistakeKind(step: AlignStep, unit: AnswerUnit | null, text: string): MistakeKind {
  switch (step.kind) {
    case 'missing':
      return unit?.role === 'particle' ? 'particle_missing' : 'word_missing';
    case 'extra':
      return PARTICLES.includes(text.slice(step.from, step.to)) ? 'particle_extra' : 'word_extra';
    case 'replaced':
      return 'wrong_word';
    default:
      return step.kind as VariantKind;
  }
}

/** A mistake with its normalized input range (from === to for a gap) and its alignment cost. */
type Found = { mistake: Mistake; from: number; to: number; cost: number };
/** One accepted answer's view of the input. `line` (grammar not used) replaces its marks. */
type Reading = {
  cost: number;
  steps: AlignStep[];
  marks: Found[];
  line: Found | null;
  ok: boolean;
};

/** Steps 4–5 for one answer: map steps to mistakes, fold grammar-only mistakes into one line. */
function readAnswer(
  input: string,
  normalized: { text: string; rawIndex: number[] },
  units: AnswerUnit[],
  words: Record<string, DiagnosisWord>,
): Reading {
  const { text, rawIndex } = normalized;
  const { steps, cost } = alignUnits(text, units, words);
  const rawStart = (from: number) => rawIndex[from];
  const rawEnd = (from: number, to: number) => (to > from ? rawIndex[to - 1] + 1 : rawIndex[from]);
  const rawText = (step: AlignStep) => input.slice(rawStart(step.from), rawEnd(step.from, step.to));
  const nearest = <T>(k: number, dir: -1 | 1, pick: (step: AlignStep) => T | null): T | null => {
    for (let j = k + dir; j >= 0 && j < steps.length; j += dir) {
      const found = pick(steps[j]);
      if (found !== null) return found;
    }
    return null;
  };
  const matchedText = (step: AlignStep) =>
    isMatched(step) && step.to > step.from ? rawText(step) : null;

  // Step 4: each non-matched step is one mistake.
  const found: (Found & { k: number })[] = [];
  let ok = true;
  for (let k = 0; k < steps.length; k++) {
    const step = steps[k];
    if (isMatched(step)) continue;
    const unit = step.unitIndex === null ? null : units[step.unitIndex];
    const word = unit?.itemId ? (words[unit.itemId] ?? null) : null;
    const mistake: Mistake = {
      kind: mistakeKind(step, unit, text),
      rawStart: rawStart(step.from),
      rawEnd: rawEnd(step.from, step.to),
      typed: rawText(step),
      expected: unit ? [unit.surface] : [],
      before: nearest(k, -1, matchedText),
      after: nearest(k, 1, matchedText),
    };
    if (unit && step.kind === 'form') {
      const dims = answerDims(unit, word, step.variant?.dims ?? {});
      if (dims) mistake.dims = dims;
      else ok = false;
    }
    if (step.kind === 'te_ta' && step.variant?.dictForm) mistake.dictForm = step.variant.dictForm;
    if ((step.kind === 'verb_group' || step.kind === 'adjective_type') && word) {
      mistake.dictForm = word.primaryForm;
      if (word.conjugationClass) mistake.conjugationClass = word.conjugationClass;
    }
    if (step.kind === 'transitivity' && word?.transitivity)
      mistake.transitivity = word.transitivity;
    const cost =
      step.kind === 'missing' || step.kind === 'extra' || step.kind === 'replaced'
        ? COST[step.kind]
        : COST.variant;
    found.push({ mistake, from: step.from, to: step.to, cost, k });
  }
  const marks = found.map(({ mistake, from, to, cost }) => ({ mistake, from, to, cost }));
  ok &&= enoughMatched(steps, units);

  // Step 5: only the grammar text ('other' units in the grammar span) differs → one line.
  // Extra text counts when it sits beside a grammar unit; at least one grammar unit must be wrong or missing.
  const onGrammar = (i: number | null) =>
    i !== null && units[i].inGrammar && units[i].role === 'other';
  const unitOf = (step: AlignStep) => step.unitIndex;
  const grammarUnitWrong = ({ mistake, k }: { mistake: Mistake; k: number }) =>
    (mistake.kind === 'wrong_word' || mistake.kind === 'word_missing') &&
    onGrammar(steps[k].unitIndex);
  const besideGrammar = ({ mistake, k }: { mistake: Mistake; k: number }) =>
    mistake.kind === 'word_extra' &&
    (onGrammar(nearest(k, -1, unitOf)) || onGrammar(nearest(k, 1, unitOf)));
  if (found.some(grammarUnitWrong) && found.every((f) => grammarUnitWrong(f) || besideGrammar(f))) {
    const from = Math.min(...found.map((f) => f.from));
    const to = Math.max(...found.map((f) => f.to));
    const mistake: Mistake = {
      kind: 'grammar_not_used',
      rawStart: rawStart(from),
      rawEnd: rawEnd(from, to),
      typed: input.slice(rawStart(from), rawEnd(from, to)),
      expected: found.filter(grammarUnitWrong).flatMap((f) => f.mistake.expected),
      before: null,
      after: null,
    };
    const lineCost = found.reduce((sum, f) => sum + f.cost, 0);
    return { cost, steps, marks: [], line: { mistake, from, to, cost: lineCost }, ok };
  }
  return { cost, steps, marks, line: null, ok: ok && marks.length <= MAX_MARKS };
}

const isGap = (f: Found) => f.from === f.to;
const sameRange = (a: Found, b: Found) => a.from === b.from && a.to === b.to;
const sameMark = (a: Found, b: Found) => sameRange(a, b) && a.mistake.kind === b.mistake.kind;
/** Places share input: a gap overlaps a range only strictly inside it; touching edges do not. */
function overlaps(a: Found, b: Found): boolean {
  if (isGap(a) && isGap(b)) return a.from === b.from;
  if (isGap(a)) return b.from < a.from && a.from < b.to;
  if (isGap(b)) return a.from < b.from && b.from < a.to;
  return a.from < b.to && b.from < a.to;
}
/** `a` is strictly inside `b`. */
const inside = (a: Found, b: Found) => b.from <= a.from && a.to <= b.to && !sameRange(a, b);

/**
 * Whether this reading accepts the learner's text at `f`'s place: every character of a range
 * is matched, or no mistake touches a gap.
 */
function accepts(reading: Reading, f: Found): boolean {
  if (isGap(f)) {
    return !reading.steps.some(
      (step) => !isMatched(step) && step.from <= f.from && f.from <= step.to,
    );
  }
  for (let i = f.from; i < f.to; i++) {
    if (!reading.steps.some((step) => isMatched(step) && step.from <= i && i < step.to)) {
      return false;
    }
  }
  return true;
}

/**
 * Marks for a wrong Build answer, or null when the app is not sure what is wrong.
 * Every accepted answer counts (the sentence, its alternates, the learner's saved answers):
 * no mark where any of them accepts the learner's text.
 * Pure and sync; `grammarLabel` is for the copy (explainMistake), not used here.
 */
export function diagnoseBuildAnswer(
  input: string,
  card: GrammarSentenceCard,
  grammarLabel: string,
): BuildDiagnosis | null {
  const key = card.diagnosisKey;
  const normalized = normalizeWithMap(input);
  const { text } = normalized;
  if (!key || !text || key.answers.length === 0) return null;

  const saved = card.userAnswers
    .map((answer) => savedAnswerUnits(answer, key.answers, key.words))
    .filter((units): units is AnswerUnit[] => units !== null);
  const answers = [...key.answers, ...saved];
  const readings = answers.map((units) => readAnswer(input, normalized, units, key.words));
  if (readings.some((r) => r.cost === 0)) return null;

  if (answers.some((units) => isChunkConcatenation(text, units))) {
    const order: Mistake = {
      kind: 'word_order',
      rawStart: 0,
      rawEnd: input.length,
      typed: input,
      expected: [],
      before: null,
      after: null,
    };
    return { marks: [], lines: [order] };
  }

  // Lowest cost wins; on a tie, a reading within the limits, then the earlier answer.
  const best = readings.reduce((a, b) =>
    b.cost < a.cost || (b.cost === a.cost && b.ok && !a.ok) ? b : a,
  );
  if (!best.ok) return null;
  const pool = readings.filter((r) => r.ok);

  if (best.line) {
    return pool.some((r) => r !== best && accepts(r, best.line as Found))
      ? null
      : { marks: [], lines: [best.line.mistake] };
  }

  // Drop a mark any answer accepts. Where another answer explains the same place no worse
  // (its marks there cost no more), keep its smaller marks if they sit inside; else drop.
  const settle = (f: Found): Found[] => {
    if (pool.some((r) => accepts(r, f))) return [];
    for (const r of pool) {
      const there = (r.line ? [r.line] : r.marks).filter((g) => overlaps(f, g));
      if (there.every((g) => sameMark(f, g)) || there.some((g) => inside(f, g))) continue;
      if (there.reduce((sum, g) => sum + g.cost, 0) > f.cost) continue;
      return there.every((g) => inside(g, f)) ? there.flatMap(settle) : [];
    }
    return [f];
  };
  const settled: Found[] = [];
  for (const f of best.marks.flatMap(settle)) {
    if (!settled.some((t) => sameMark(f, t))) settled.push(f);
  }

  // The same mark in several answers: every correct text, and only the form dims all agree on.
  const marks: Mistake[] = [];
  for (const f of settled.sort((a, b) => a.from - b.from || a.to - b.to)) {
    const same = pool.flatMap((r) => r.marks).filter((g) => sameMark(f, g));
    const expected = [...new Set(same.flatMap((g) => g.mistake.expected))];
    const mistake = { ...f.mistake, expected };
    if (f.mistake.dims) {
      const dims = Object.fromEntries(
        Object.entries(f.mistake.dims).filter(([key, value]) =>
          same.every((g) => g.mistake.dims?.[key as keyof FormDims] === value),
        ),
      ) as FormDims;
      if (Object.keys(dims).length === 0) continue;
      mistake.dims = dims;
    }
    marks.push(mistake);
  }
  return marks.length > 0 ? { marks, lines: [] } : null;
}
