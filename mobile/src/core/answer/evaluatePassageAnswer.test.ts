import { evaluatePassageAnswer } from '@/core/answer/evaluatePassageAnswer';

describe('evaluatePassageAnswer', () => {
  it('returns correct for exact Japanese match', () => {
    expect(evaluatePassageAnswer('学生', ['学生', 'がくせい'])).toBe('correct');
  });

  it('returns correct for exact hiragana match', () => {
    expect(evaluatePassageAnswer('がくせい', ['学生', 'がくせい'])).toBe('correct');
  });

  it('trims whitespace before matching', () => {
    expect(evaluatePassageAnswer('  学生  ', ['学生'])).toBe('correct');
  });

  it('compares ASCII answers case-insensitively', () => {
    expect(evaluatePassageAnswer('Gakusei', ['gakusei'])).toBe('correct');
    expect(evaluatePassageAnswer('STUDENT', ['student'])).toBe('correct');
  });

  it('returns incorrect for empty or whitespace-only answers', () => {
    expect(evaluatePassageAnswer('', ['学生'])).toBe('incorrect');
    expect(evaluatePassageAnswer('   ', ['学生'])).toBe('incorrect');
  });

  it('returns incorrect when no accepted form matches', () => {
    expect(evaluatePassageAnswer('先生', ['学生', 'がくせい'])).toBe('incorrect');
  });

  it('matches any accepted form in the list', () => {
    expect(evaluatePassageAnswer('本', ['水', '本', 'ほん'])).toBe('correct');
  });

  it('accepts katakana input for a hiragana accepted answer', () => {
    expect(evaluatePassageAnswer('ガクセイ', ['学生', 'がくせい'])).toBe('correct');
  });

  it('accepts romaji input for a kana accepted answer', () => {
    expect(evaluatePassageAnswer('gakusei', ['学生', 'がくせい'])).toBe('correct');
  });

  it('folds full-width latin input (IME) to ASCII', () => {
    expect(evaluatePassageAnswer('ｓｔｕｄｅｎｔ', ['student'])).toBe('correct');
  });

  it('still rejects a different kana word', () => {
    expect(evaluatePassageAnswer('センセイ', ['学生', 'がくせい'])).toBe('incorrect');
  });
});
