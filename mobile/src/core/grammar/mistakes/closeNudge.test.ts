import { closeNudge } from './closeNudge';
import type { BuildDiagnosis, Mistake, MistakeKind } from './mistake.types';

const mistake = (kind: MistakeKind): Mistake => ({
  kind,
  rawStart: 0,
  rawEnd: 1,
  typed: 'x',
  expected: ['y'],
  before: null,
  after: null,
});
const marks = (...kinds: MistakeKind[]): BuildDiagnosis => ({
  marks: kinds.map(mistake),
  lines: [],
});

describe('closeNudge', () => {
  it('names particles for one particle mistake', () => {
    expect(closeNudge(marks('particle_extra'))).toBe('~ Close! Check your particles.');
  });

  it('names conjugation for a form mistake', () => {
    expect(closeNudge(marks('form'))).toBe('~ Close! Check your conjugation.');
  });

  it('names spelling for a spelling mistake', () => {
    expect(closeNudge(marks('spelling_sokuon'))).toBe('~ Close! Check your spelling.');
  });

  it('names spelling for a typo', () => {
    expect(closeNudge(marks('spelling_typo'))).toBe('~ Close! Check your spelling.');
  });

  it('names each area once for two mistakes', () => {
    expect(closeNudge(marks('particle_wrong', 'particle_missing'))).toBe(
      '~ Close! Check your particles.',
    );
    expect(closeNudge(marks('te_ta', 'particle_wrong'))).toBe(
      '~ Close! Check your particles and conjugation.',
    );
  });

  it('is null for three small mistakes', () => {
    expect(closeNudge(marks('particle_wrong', 'particle_extra', 'form'))).toBeNull();
  });

  it('is null when any mistake is not small', () => {
    expect(closeNudge(marks('particle_wrong', 'wrong_word'))).toBeNull();
    expect(closeNudge(marks('word_missing'))).toBeNull();
  });

  it('is null for a whole-answer line (word order, grammar not used)', () => {
    expect(closeNudge({ marks: [], lines: [mistake('word_order')] })).toBeNull();
    expect(closeNudge({ marks: [], lines: [mistake('grammar_not_used')] })).toBeNull();
  });

  it('is null when there is no diagnosis', () => {
    expect(closeNudge(null)).toBeNull();
  });
});
