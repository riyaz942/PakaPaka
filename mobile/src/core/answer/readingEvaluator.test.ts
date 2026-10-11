import { evaluateReading, normalizeKana } from './readingEvaluator';

describe('normalizeKana', () => {
  it('converts katakana to hiragana', () => {
    expect(normalizeKana('イチ')).toBe('いち');
  });

  it('ignores romaji letter case', () => {
    expect(normalizeKana('ICHI')).toBe('いち');
    expect(normalizeKana('Ichi')).toBe('いち');
  });
});

describe('evaluateReading', () => {
  const readings = ['いち'];

  it('returns correct for exact kana', () => {
    expect(evaluateReading('いち', readings).result).toBe('correct');
  });

  it('accepts uppercase romaji as equivalent', () => {
    expect(evaluateReading('ICHI', readings).result).toBe('correct');
  });

  it('accepts katakana as equivalent', () => {
    expect(evaluateReading('イチ', readings).result).toBe('correct');
  });

  it('requires exact match for short readings (no typo tolerance at length <= 2)', () => {
    // A one-edit miss on a 2-mora reading is a different valid kana, not a fat-finger.
    const result = evaluateReading('いぢ', readings);
    expect(result.result).toBe('incorrect');
    expect(result.displayAnswer).toBe('いち');
  });

  it('treats a wrong single-mora particle as incorrect, not a typo', () => {
    const result = evaluateReading('が', ['を']);
    expect(result.result).toBe('incorrect');
    expect(result.displayAnswer).toBe('を');
  });

  it('returns typo for a one-edit near miss on a longer reading', () => {
    // Length >= 3 keeps fat-finger tolerance of one edit.
    expect(evaluateReading('たべみ', ['たべる']).result).toBe('typo');
  });

  it('returns incorrect for wrong reading', () => {
    const result = evaluateReading('に', readings);
    expect(result.result).toBe('incorrect');
    expect(result.displayAnswer).toBe('いち');
  });

  it('keeps displayAnswer aligned when an earlier reading normalizes to empty', () => {
    // First entry is whitespace-only → filtered out. A pre-filter index would
    // surface the empty string; the original must be returned instead.
    const result = evaluateReading('ぜんぶ', ['  ', 'いち', 'にち']);
    expect(result.result).toBe('incorrect');
    expect(result.displayAnswer).toBe('いち');
  });
});
