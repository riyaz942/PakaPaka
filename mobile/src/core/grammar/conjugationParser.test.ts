import { parseConjugation } from './conjugationParser';
import type { GrammarAnswerContext } from './grammar.types';

describe('parseConjugation', () => {
  const politeGrammar: GrammarAnswerContext = {
    conjugationRules: { polite: true },
    acceptedForms: ['です'],
  };

  it('accepts an exact accepted form', () => {
    expect(parseConjugation('です', politeGrammar)).toEqual({ status: 'correct' });
  });

  it('rejects wrong conjugation when polite is required', () => {
    const result = parseConjugation('だ', politeGrammar);
    expect(result.status).toBe('incorrect');
    if (result.status === 'incorrect') {
      expect(result.displayAnswer).toBe('です');
    }
  });

  it('returns unsupported for unhandled particle patterns', () => {
    const particleGrammar: GrammarAnswerContext = {
      conjugationRules: { particle: 'object' },
      acceptedForms: ['を'],
    };
    expect(parseConjugation('が', particleGrammar)).toEqual({ status: 'unsupported' });
  });
});
