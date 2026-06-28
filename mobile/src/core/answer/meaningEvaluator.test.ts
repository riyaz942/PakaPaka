import { evaluateMeaning, meaningTypoThreshold, normalizeMeaning } from './meaningEvaluator';

describe('normalizeMeaning', () => {
  it('lowercases and trims', () => {
    expect(normalizeMeaning('  Hello  ')).toBe('hello');
  });

  it('collapses whitespace', () => {
    expect(normalizeMeaning('one   two')).toBe('one two');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeMeaning('eat.')).toBe('eat');
  });
});

describe('meaningTypoThreshold', () => {
  it('scales with length', () => {
    expect(meaningTypoThreshold(3)).toBe(0);
    expect(meaningTypoThreshold(4)).toBe(1);
    expect(meaningTypoThreshold(6)).toBe(2);
  });
});

describe('evaluateMeaning', () => {
  const meanings = ['eat', 'food'];

  it('returns correct for exact match', () => {
    expect(evaluateMeaning('eat', meanings).result).toBe('correct');
  });

  it('returns correct for synonym match', () => {
    expect(evaluateMeaning('food', meanings).result).toBe('correct');
  });

  it('normalizes case and whitespace', () => {
    expect(evaluateMeaning('  EAT  ', meanings).result).toBe('correct');
  });

  it('returns typo for in-threshold near miss', () => {
    expect(evaluateMeaning('foood', ['food']).result).toBe('typo');
  });

  it('returns incorrect for out-of-threshold answer', () => {
    const result = evaluateMeaning('completely wrong', meanings);
    expect(result.result).toBe('incorrect');
    expect(result.displayAnswer).toBe('eat');
  });

  it('returns incorrect for empty answer', () => {
    expect(evaluateMeaning('', meanings).result).toBe('incorrect');
  });
});
