import { normalizeBuildText } from '@/core/grammar/buildEvaluator';
import type { GrammarSentenceCard } from '@/core/srs/srs.types';

import { alignUnits } from './alignUnits';
import type {
  Alignment,
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
import { formDims, PARTICLES, unitForm } from './unitVariants';

const MAX_MARKS = 3;

type Allowed = Record<number, string[]>;

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

/**
 * Per answer, the saved answers' text at each unit where they differ from it ('' = may be absent).
 * Extra saved text joins the unit after it (or the last unit), so an extra 私は stays allowed.
 */
function savedAllowances(
  saved: string[],
  answers: AnswerUnit[][],
  words: Record<string, DiagnosisWord>,
): Allowed[] {
  return answers.map((units) => {
    const allowed: Allowed = {};
    for (const text of saved) {
      const { steps } = alignUnits(text, units, words);
      const marks = steps.filter((step) => !isMatched(step)).length;
      if (marks === 0 || marks > MAX_MARKS || !enoughMatched(steps, units)) continue;
      const groups: {
        unitIndex: number;
        from: number;
        to: number;
        changed: boolean;
      }[] = [];
      let extraFrom: number | null = null;
      for (const step of steps) {
        if (step.unitIndex === null) {
          extraFrom ??= step.from;
          continue;
        }
        groups.push({
          unitIndex: step.unitIndex,
          from: extraFrom ?? step.from,
          to: step.to,
          changed: extraFrom !== null || step.kind !== 'exact',
        });
        extraFrom = null;
      }
      const last = groups[groups.length - 1];
      if (extraFrom !== null && last) Object.assign(last, { to: text.length, changed: true });
      for (const group of groups) {
        if (!group.changed) continue;
        const list = (allowed[group.unitIndex] ??= []);
        const slice = text.slice(group.from, group.to);
        if (!list.includes(slice)) list.push(slice);
      }
    }
    return allowed;
  });
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

const sameUnit = (a: AnswerUnit, b: AnswerUnit) =>
  a.surface === b.surface && a.reading === b.reading && a.role === b.role;

/**
 * Marks for a wrong Build answer, or null when the app is not sure what is wrong.
 * Pure and sync; `grammarLabel` is for the copy (explainMistake), not used here.
 */
export function diagnoseBuildAnswer(
  input: string,
  card: GrammarSentenceCard,
  grammarLabel: string,
): BuildDiagnosis | null {
  const key = card.diagnosisKey;
  const { text, rawIndex } = normalizeWithMap(input);
  if (!key || !text || key.answers.length === 0) return null;

  const allowances = savedAllowances(card.userAnswers, key.answers, key.words);
  let best: Alignment | null = null;
  let bestIndex = 0;
  for (let i = 0; i < key.answers.length; i++) {
    const alignment = alignUnits(text, key.answers[i], key.words, allowances[i]);
    if (!best || alignment.cost < best.cost) {
      best = alignment;
      bestIndex = i;
    }
  }
  if (!best || best.cost === 0) return null;

  if (key.answers.some((units) => isChunkConcatenation(text, units))) {
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

  const units = key.answers[bestIndex];
  const { steps } = best;
  const rawStart = (step: AlignStep) => rawIndex[step.from];
  const rawEnd = (step: AlignStep) =>
    step.to > step.from ? rawIndex[step.to - 1] + 1 : rawIndex[step.from];
  const rawText = (step: AlignStep) => input.slice(rawStart(step), rawEnd(step));
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
  const found: { mistake: Mistake; k: number }[] = [];
  for (let k = 0; k < steps.length; k++) {
    const step = steps[k];
    if (isMatched(step)) continue;
    const unit = step.unitIndex === null ? null : units[step.unitIndex];
    const word = unit?.itemId ? (key.words[unit.itemId] ?? null) : null;
    const mistake: Mistake = {
      kind: mistakeKind(step, unit, text),
      rawStart: rawStart(step),
      rawEnd: rawEnd(step),
      typed: rawText(step),
      expected: unit ? [unit.surface] : [],
      before: nearest(k, -1, matchedText),
      after: nearest(k, 1, matchedText),
    };
    if (unit && step.kind === 'form') {
      const dims = answerDims(unit, word, step.variant?.dims ?? {});
      if (!dims) return null;
      mistake.dims = dims;
    }
    if (step.kind === 'te_ta' && step.variant?.dictForm) mistake.dictForm = step.variant.dictForm;
    if ((step.kind === 'verb_group' || step.kind === 'adjective_type') && word) {
      mistake.dictForm = word.primaryForm;
    }
    if (step.kind === 'transitivity' && word?.transitivity)
      mistake.transitivity = word.transitivity;
    found.push({ mistake, k });
  }

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
    const start = Math.min(...found.map((f) => f.mistake.rawStart));
    const end = Math.max(...found.map((f) => f.mistake.rawEnd));
    const notUsed: Mistake = {
      kind: 'grammar_not_used',
      rawStart: start,
      rawEnd: end,
      typed: input.slice(start, end),
      expected: found.filter(grammarUnitWrong).flatMap((f) => f.mistake.expected),
      before: null,
      after: null,
    };
    return enoughMatched(steps, units) ? { marks: [], lines: [notUsed] } : null;
  }

  // Step 6: name the particle every other accepted answer has at the same place.
  for (const { mistake, k } of found) {
    const i = steps[k].unitIndex;
    if (i === null || (mistake.kind !== 'particle_wrong' && mistake.kind !== 'particle_missing')) {
      continue;
    }
    const others = key.answers
      .filter(
        (other, a) =>
          a !== bestIndex &&
          other.length === units.length &&
          other[i].role === 'particle' &&
          other.every((u, j) => j === i || sameUnit(u, units[j])),
      )
      .map((other) => other[i].surface);
    const saved = (allowances[bestIndex][i] ?? []).filter((t) => PARTICLES.includes(t));
    for (const particle of [...others, ...saved]) {
      if (!mistake.expected.includes(particle)) mistake.expected.push(particle);
    }
  }

  // Step 7: too different → no guess. Steps are in input order, so the marks are too.
  const marks = found.map((f) => f.mistake);
  if (marks.length > MAX_MARKS || !enoughMatched(steps, units)) return null;
  return { marks, lines: [] };
}
