import { assessGrammarNearMiss, resolveCompletedSentence } from './nearMiss';

describe('assessGrammarNearMiss (Plan 10)', () => {
  const context = { acceptedForms: ['は'] };

  it('flags a longer answer containing the chunk as incomplete', () => {
    expect(assessGrammarNearMiss('私は', context)).toBe('incomplete');
    expect(assessGrammarNearMiss('は学生', context)).toBe('incomplete');
  });

  it('flags a pasted full sentence as incomplete', () => {
    expect(assessGrammarNearMiss('私は学生です。', context)).toBe('incomplete');
  });

  it('treats the exact wrong particle as plain incorrect, not incomplete', () => {
    expect(assessGrammarNearMiss('が', context)).toBe('none');
  });

  it('treats the exact right chunk as none (would have graded correct)', () => {
    expect(assessGrammarNearMiss('は', context)).toBe('none');
  });

  it('treats a longer answer without the chunk as plain incorrect', () => {
    expect(assessGrammarNearMiss('学生です', context)).toBe('none');
  });

  it('matches multi-mora chunks', () => {
    expect(
      assessGrammarNearMiss('待ってください', { acceptedForms: ['てください'] }),
    ).toBe('incomplete');
  });

  it('handles empty input and empty forms safely', () => {
    expect(assessGrammarNearMiss('', context)).toBe('none');
    expect(assessGrammarNearMiss('   ', context)).toBe('none');
    expect(assessGrammarNearMiss('は', { acceptedForms: [] })).toBe('none');
  });
});

describe('resolveCompletedSentence', () => {
  it('fills the blank with the answer', () => {
    expect(resolveCompletedSentence('私＿＿＿学生です。', 'は')).toBe('私は学生です。');
  });

  it('returns null without a cloze prompt or blank', () => {
    expect(resolveCompletedSentence(null, 'は')).toBeNull();
    expect(resolveCompletedSentence('Noun + comment', 'は')).toBeNull();
  });
});
