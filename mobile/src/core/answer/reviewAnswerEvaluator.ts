import type { EvaluationResult } from '@/core/answer/answer.types';
import { evaluateMeaning, normalizeMeaning } from '@/core/answer/meaningEvaluator';
import { evaluateReading, normalizeKana } from '@/core/answer/readingEvaluator';
import { hasJapaneseScript } from '@/core/answer/scriptDetection';
import { evaluateGrammarBuild } from '@/core/grammar/buildEvaluator';
import { closeNudge } from '@/core/grammar/mistakes/closeNudge';
import { diagnoseBuildAnswer } from '@/core/grammar/mistakes/diagnoseBuildAnswer';
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

const NON_JAPANESE_CHAR_REGEX = /[^\s぀-ヿ㐀-䶿一-鿿豈-﫿]/;

/**
 * True when a reading answer still holds English letters, digits or symbols
 * after romaji → kana conversion (so valid romaji never trips it). Such input
 * is a nudge, not a miss.
 */
function hasNonJapaneseResidue(userAnswer: string): boolean {
  return NON_JAPANESE_CHAR_REGEX.test(normalizeKana(userAnswer));
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

  // Grammar Build card (spec §5.2): the whole sentence, no typo tolerance.
  // The Read card is a meaning prompt and takes the meaning path below.
  if (promptType === 'production' && item.grammarBuild) {
    const result = evaluateGrammarBuild(userAnswer, item.grammarBuild);
    if (result !== 'incorrect') return { result };
    // 1–2 small slips: nudge and re-prompt instead of grading.
    const nudge = closeNudge(diagnoseBuildAnswer(userAnswer, item.grammarBuild, item.primaryForm));
    return nudge
      ? { result: 'close', nudge }
      : { result, displayAnswer: item.grammarBuild.japanese };
  }

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
    if (evaluation.result !== 'correct' && hasNonJapaneseResidue(userAnswer)) {
      return { result: 'wrong_script' };
    }
    // Right item, wrong reading type (FR82): an exact kun'yomi at the on'yomi
    // prompt nudges and re-prompts instead of grading. Checked on any
    // non-correct outcome so an exact alternate that also sits within on'yomi
    // typo distance still nudges (never typo/weakness). Near-miss on'yomi that
    // is not an exact alternate still uses the typo path.
    if (evaluation.result !== 'correct') {
      const alternates = answerKey.alternateReadings;
      if (alternates && alternates.length > 0) {
        const normalized = normalizeKana(userAnswer);
        if (
          normalized &&
          alternates.some((reading) => normalizeKana(reading) === normalized)
        ) {
          return { result: 'wrong_reading_type' };
        }
      }
    }
    if (evaluation.result === 'incorrect') {
      if (
        !hasJapaneseScript(userAnswer) &&
        matchesAcceptedMeaning(userAnswer, answerKey.acceptedMeanings)
      ) {
        return { result: 'wrong_script' };
      }
    }
    return evaluation;
  }

  const evaluation = evaluateReading(userAnswer, answerKey.acceptedReadings);
  if (evaluation.result !== 'correct' && hasNonJapaneseResidue(userAnswer)) {
    return { result: 'wrong_script' };
  }
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
 * FSRS grade mapping: correct → Good (3); incorrect → Again (1); typo,
 * wrong_script, wrong_reading_type, other_grammar and close → no grade (non-terminal). Revealing
 * hints never changes the grade — the hint ladder is scaffolding, not a
 * penalty (Plan 10).
 */
export function gradeForResult(
  result: EvaluationResult['result'],
): 1 | 2 | 3 | null {
  if (result === 'correct') return 3;
  if (result === 'incorrect') return 1;
  return null;
}
