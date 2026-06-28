import type { EvaluationResult } from '@/core/answer/answer.types';
import { evaluateMeaning } from '@/core/answer/meaningEvaluator';
import { evaluateReading } from '@/core/answer/readingEvaluator';
import { evaluateGrammarAnswer } from '@/core/grammar/answerEvaluator';
import type { ReviewItem } from '@/core/srs/srs.types';

/**
 * Routes a review answer to the correct evaluator based on prompt type and answer key.
 * Vocab reading prompts with no accepted readings fall back to meaning validation (seed gap).
 */
export function evaluateReviewAnswer(
  item: ReviewItem,
  userAnswer: string,
): EvaluationResult {
  const { promptType, answerKey } = item;

  if (promptType === 'meaning') {
    return evaluateMeaning(userAnswer, answerKey.acceptedMeanings);
  }

  if (promptType === 'reading') {
    if (answerKey.acceptedReadings.length === 0) {
      if (__DEV__) {
        console.warn(
          `[Review] Item ${item.itemId} has reading prompt but no accepted readings; falling back to meaning validation`,
        );
      }
      return evaluateMeaning(userAnswer, answerKey.acceptedMeanings);
    }
    return evaluateReading(userAnswer, answerKey.acceptedReadings);
  }

  if (answerKey.grammar) {
    return evaluateGrammarAnswer(userAnswer, answerKey.grammar);
  }

  return evaluateReading(userAnswer, answerKey.acceptedReadings);
}

/**
 * FSRS grade mapping for Story 5.3: correct → Good (3), incorrect → Again (1), typo → no grade.
 */
export function gradeForResult(result: EvaluationResult['result']): 1 | 3 | null {
  if (result === 'correct') return 3;
  if (result === 'incorrect') return 1;
  return null;
}
