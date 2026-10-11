import {
  deriveMeaningCandidates,
  evaluateMeaning,
  meaningTypoThreshold,
  normalizeMeaning,
} from './meaningEvaluator';

describe('deriveMeaningCandidates', () => {
  it('returns the meaning itself for a simple string', () => {
    expect(deriveMeaningCandidates('red')).toEqual(['red']);
  });

  it('splits slash-separated alternatives', () => {
    expect(deriveMeaningCandidates('hole / cave')).toEqual(
      expect.arrayContaining(['hole / cave', 'hole', 'cave']),
    );
  });

  it('accepts alternatives without trailing parenthetical qualifiers', () => {
    const candidates = deriveMeaningCandidates('at / by / with (place of action, means)');
    expect(candidates).toEqual(expect.arrayContaining(['at', 'by', 'with']));
  });

  it('keeps commas inside qualifiers intact', () => {
    const candidates = deriveMeaningCandidates('to / at (direction, time, target)');
    expect(candidates).toEqual(expect.arrayContaining(['to', 'at']));
    expect(candidates).not.toEqual(expect.arrayContaining(['time', 'target)']));
  });

  it('returns empty for blank input', () => {
    expect(deriveMeaningCandidates('  ')).toEqual([]);
  });
});

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

  it('ignores letter case', () => {
    expect(evaluateMeaning('EAT', meanings).result).toBe('correct');
    expect(evaluateMeaning('Food', ['FOOD']).result).toBe('correct');
  });

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
