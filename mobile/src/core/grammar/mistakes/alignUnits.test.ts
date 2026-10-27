import { normalizeBuildText } from '@/core/grammar/buildEvaluator';

import { alignUnits } from './alignUnits';
import type { AnswerUnit, DiagnosisWord } from './mistake.types';

const unit = (surface: string, reading: string, over: Partial<AnswerUnit> = {}): AnswerUnit => ({
  surface,
  reading,
  role: 'word',
  itemId: null,
  inGrammar: false,
  ...over,
});
const particle = (p: string) => unit(p, p, { role: 'particle' });

// 今年は学校で日本語を勉強します
const units: AnswerUnit[] = [
  unit('今年', 'ことし'),
  particle('は'),
  unit('学校', 'がっこう'),
  particle('で'),
  unit('日本語', 'にほんご'),
  particle('を'),
  unit('勉強します', 'べんきょうします', { itemId: 'w1', inGrammar: true }),
];
const words: Record<string, DiagnosisWord> = {
  w1: {
    itemId: 'w1',
    primaryForm: '勉強する',
    furigana: '勉強[べんきょう]する',
    conjugationClass: 'suru',
    transitivity: null,
    partner: null,
    homophones: [],
  },
};
const align = (raw: string, allowed?: Record<number, string[]>) =>
  alignUnits(normalizeBuildText(raw), units, words, allowed);

describe('alignUnits', () => {
  it('aligns the answer itself at cost 0', () => {
    const { steps, cost } = align('今年は学校で日本語を勉強します');
    expect(cost).toBe(0);
    expect(steps.map((s) => s.kind)).toEqual(Array(7).fill('exact'));
  });

  it('finds a missing particle, a wrong particle and a wrong form', () => {
    const { steps, cost } = align('今年学校に日本語を勉強する');
    expect(cost).toBe(3);
    expect(steps).toContainEqual(expect.objectContaining({ kind: 'missing', unitIndex: 1 }));
    expect(steps).toContainEqual(
      expect.objectContaining({
        kind: 'particle_wrong',
        unitIndex: 3,
        variant: expect.objectContaining({ text: 'に' }),
      }),
    );
    expect(steps).toContainEqual(expect.objectContaining({ kind: 'form', unitIndex: 6 }));
  });

  it('matches a kana-folded input against the reading', () => {
    const { steps } = align('ことしはがっこうでにほんごをべんきょうする');
    expect(steps[2]).toEqual({ kind: 'exact', unitIndex: 2, from: 4, to: 8 });
    expect(steps[6]).toEqual(expect.objectContaining({ kind: 'form', unitIndex: 6 }));
  });

  it('marks inserted text as extra', () => {
    const { steps, cost } = align('今年は明日学校で日本語を勉強します');
    expect(cost).toBe(1);
    expect(steps.filter((s) => s.kind === 'extra')).toEqual([
      { kind: 'extra', unitIndex: null, from: 3, to: 5 },
    ]);
  });

  it('accepts an allowed text at cost 0', () => {
    const { steps, cost } = align('今年は学校へ日本語を勉強します', {
      3: ['へ'],
    });
    expect(cost).toBe(0);
    expect(steps[3]).toEqual({ kind: 'allowed', unitIndex: 3, from: 5, to: 6 });
  });

  it('lets an empty allowed text make a unit optional', () => {
    const { steps, cost } = align('今年は学校日本語を勉強します', { 3: [''] });
    expect(cost).toBe(0);
    expect(steps[3]).toEqual({ kind: 'allowed', unitIndex: 3, from: 5, to: 5 });
  });

  it('replaces an unknown slice of a unit at 1.5', () => {
    const { steps, cost } = align('今年は学校で日本語をテスト');
    expect(cost).toBe(1.5);
    expect(steps[6]).toEqual({
      kind: 'replaced',
      unitIndex: 6,
      from: 10,
      to: 13,
    });
  });

  it('breaks ties toward the earlier kind', () => {
    // 学校 is exact by surface and reading would not matter; allowed with the same text must not win.
    const { steps } = align('今年は学校で日本語を勉強します', { 2: ['学校'] });
    expect(steps[2].kind).toBe('exact');
  });

  it('handles empty input and empty units', () => {
    const empty = alignUnits('', units, words);
    expect(empty.steps.map((s) => s.kind)).toEqual(Array(7).fill('missing'));
    expect(empty.cost).toBe(7);
    const none = alignUnits('abc', [], words);
    expect(none.steps).toEqual([{ kind: 'extra', unitIndex: null, from: 0, to: 3 }]);
  });
});
