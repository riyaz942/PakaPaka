import type { AnswerResult } from '@/core/answer/answer.types';

export function evaluatePassageAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
): AnswerResult {
  const normalized = userAnswer.trim();
  if (!normalized) {
    return 'incorrect';
  }

  for (const accepted of acceptedAnswers) {
    const trimmed = accepted.trim();
    if (!trimmed) {
      continue;
    }
    if (normalized === trimmed) {
      return 'correct';
    }
    if (/^[\x00-\x7F]+$/.test(trimmed) && normalized.toLowerCase() === trimmed.toLowerCase()) {
      return 'correct';
    }
  }

  return 'incorrect';
}
