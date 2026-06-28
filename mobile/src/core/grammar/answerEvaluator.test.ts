import { evaluateGrammarAnswer } from './answerEvaluator';

describe('evaluateGrammarAnswer', () => {
  const politeGrammar = {
    conjugationRules: { polite: true },
    acceptedForms: ['です'],
  };

  it('returns correct via parser exact match', () => {
    expect(evaluateGrammarAnswer('です', politeGrammar).result).toBe('correct');
  });

  it('returns incorrect for wrong conjugation via parser', () => {
    const result = evaluateGrammarAnswer('だ', politeGrammar);
    expect(result.result).toBe('incorrect');
    expect(result.displayAnswer).toBe('です');
  });

  it('falls back to Levenshtein for unsupported patterns', () => {
    const particleGrammar = {
      conjugationRules: { particle: 'object' },
      acceptedForms: ['を'],
    };
    const exact = evaluateGrammarAnswer('を', particleGrammar);
    expect(exact.result).toBe('correct');

    const wrong = evaluateGrammarAnswer('です', particleGrammar);
    expect(wrong.result).toBe('incorrect');
  });
});
