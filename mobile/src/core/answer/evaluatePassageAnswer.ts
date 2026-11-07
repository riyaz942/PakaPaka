import type { AnswerResult } from '@/core/answer/answer.types';
import { normalizeKana } from '@/core/answer/readingEvaluator';

/** Passage answers never use typo tolerance or reading/script nudges — only correct/incorrect. */
export type PassageAnswerResult = Exclude<
  AnswerResult,
  'typo' | 'wrong_script' | 'wrong_reading_type' | 'other_grammar' | 'close'
>;

/**
 * Same normalization pipeline as the review path: NFKC folds full-width latin
 * and half-width katakana, lowercasing handles ASCII case, and normalizeKana
 * (wanakana.toHiragana + trim) folds katakana/romaji to hiragana.
 */
function normalizeForComparison(text: string): string {
  return normalizeKana(text.normalize('NFKC').toLowerCase());
}

export function evaluatePassageAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
): PassageAnswerResult {
  const trimmed = userAnswer.trim();
  if (!trimmed) {
    return 'incorrect';
  }

  const normalized = normalizeForComparison(trimmed);

  for (const accepted of acceptedAnswers) {
    const acceptedTrimmed = accepted.trim();
    if (!acceptedTrimmed) {
      continue;
    }
    if (trimmed === acceptedTrimmed) {
      return 'correct';
    }
    if (normalized === normalizeForComparison(acceptedTrimmed)) {
      return 'correct';
    }
  }

  return 'incorrect';
}
