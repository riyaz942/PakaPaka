import type { EvaluationResult } from '@/core/answer/answer.types';
import { evaluateMeaning, normalizeMeaning } from '@/core/answer/meaningEvaluator';
import { evaluateReading } from '@/core/answer/readingEvaluator';
import { hasJapaneseScript } from '@/core/answer/scriptDetection';
import { evaluateGrammarAnswer } from '@/core/grammar/answerEvaluator';
import type { ReviewItem } from '@/core/srs/srs.types';

/**
 * A Latin answer to a reading/production prompt is only a category error (the
 * user answered the wrong question) when it exactly matches an accepted
 * meaning — romaji is a legitimate reading input, so a mere reading miss must
 * still grade as incorrect, never as wrong_script.
 */
function matchesAcceptedMeaning(userAnswer: string, acceptedMeanings: string[]): boolean {
  const normalized = normalizeMeaning(userAnswer);
  if (!normalized) return false;
  return acceptedMeanings.some((meaning) => normalizeMeaning(meaning) === normalized);
}

/**
 * Routes a review answer to the correct evaluator based on prompt type and answer key.
 * Vocab reading prompts with no accepted readings fall back to meaning validation (seed gap).
 * Script mixups (kana at a meaning prompt, an English meaning at a reading
 * prompt) return `wrong_script` — non-terminal, like `typo`.
 */
export function evaluateReviewAnswer(
  item: ReviewItem,
  userAnswer: string,
): EvaluationResult {
  const { promptType, answerKey } = item;

  if (promptType === 'meaning') {
    if (hasJapaneseScript(userAnswer)) {
      return { result: 'wrong_script' };
    }
    return evaluateMeaning(userAnswer, answerKey.acceptedMeanings);
  }

  if (promptType === 'reading') {
    // Kana-only vocab carries a reading identical to its surface form; grading
    // "type what you see" teaches nothing, so validate the meaning instead.
    const nonTautologicalReadings = answerKey.acceptedReadings.filter(
      (reading) => reading !== item.primaryForm,
    );
    if (nonTautologicalReadings.length === 0) {
      if (__DEV__ && answerKey.acceptedReadings.length === 0) {
        console.warn(
          `[Review] Item ${item.itemId} has reading prompt but no accepted readings; falling back to meaning validation`,
        );
      }
      return evaluateMeaning(userAnswer, answerKey.acceptedMeanings);
    }
    const evaluation = evaluateReading(userAnswer, answerKey.acceptedReadings);
    if (
      evaluation.result === 'incorrect' &&
      !hasJapaneseScript(userAnswer) &&
      matchesAcceptedMeaning(userAnswer, answerKey.acceptedMeanings)
    ) {
      return { result: 'wrong_script' };
    }
    return evaluation;
  }

  if (answerKey.grammar) {
    return evaluateGrammarAnswer(userAnswer, answerKey.grammar);
  }

  const evaluation = evaluateReading(userAnswer, answerKey.acceptedReadings);
  if (
    evaluation.result === 'incorrect' &&
    !hasJapaneseScript(userAnswer) &&
    matchesAcceptedMeaning(userAnswer, answerKey.acceptedMeanings)
  ) {
    return { result: 'wrong_script' };
  }
  return evaluation;
}

/**
 * FSRS grade mapping: correct → Good (3) or Hard (2) when hints were used;
 * incorrect → Again (1); typo and wrong_script → no grade (non-terminal).
 */
export function gradeForResult(
  result: EvaluationResult['result'],
  options?: { hintsUsed?: number },
): 1 | 2 | 3 | null {
  if (result === 'correct') {
    if (options?.hintsUsed && options.hintsUsed > 0) return 2;
    return 3;
  }
  if (result === 'incorrect') return 1;
  return null;
}
