import type { EvaluationResult } from '@/core/answer/answer.types';
import { evaluateReading } from '@/core/answer/readingEvaluator';

import { parseConjugation } from './conjugationParser';
import type { GrammarAnswerContext } from './grammar.types';

export function evaluateGrammarAnswer(
  userAnswer: string,
  grammar: GrammarAnswerContext,
): EvaluationResult {
  const parseResult = parseConjugation(userAnswer, grammar);

  if (parseResult.status === 'correct') {
    return { result: 'correct' };
  }

  if (parseResult.status === 'incorrect') {
    return { result: 'incorrect', displayAnswer: parseResult.displayAnswer };
  }

  if (__DEV__) {
    console.log('[grammar] conjugation parser unsupported; using Levenshtein fallback');
  }

  return evaluateReading(userAnswer, grammar.acceptedForms);
}
