import * as wanakana from 'wanakana';

import type { EvaluationResult } from '@/core/answer/answer.types';

import { levenshtein } from './levenshtein';

/**
 * Length-scaled kana typo tolerance. Readings are short, so single/double-mora
 * forms (most particles and one-kana readings) require an exact match — a
 * different valid particle must never be accepted as a "close" near-miss.
 */
function kanaTypoThreshold(len: number): number {
  return len <= 2 ? 0 : 1;
}

export function normalizeKana(text: string): string {
  return wanakana.toHiragana(text.trim().toLowerCase());
}

export function evaluateReading(
  userAnswer: string,
  acceptedReadings: string[],
): EvaluationResult {
  const normalized = normalizeKana(userAnswer);
  if (!normalized) {
    return { result: 'incorrect', displayAnswer: acceptedReadings[0] };
  }

  // Keep each normalized form paired with its original so the revealed
  // display answer stays aligned even when some readings normalize to empty.
  const accepted = acceptedReadings
    .map((original) => ({ original, normalized: normalizeKana(original) }))
    .filter((pair) => pair.normalized.length > 0);

  if (accepted.length === 0) {
    return { result: 'incorrect' };
  }

  for (const candidate of accepted) {
    if (normalized === candidate.normalized) {
      return { result: 'correct' };
    }
  }

  let closest = accepted[0];
  let minDistance = Infinity;
  for (const candidate of accepted) {
    const distance = levenshtein(normalized, candidate.normalized);
    if (distance < minDistance) {
      minDistance = distance;
      closest = candidate;
    }
  }

  if (minDistance > 0 && minDistance <= kanaTypoThreshold(closest.normalized.length)) {
    return { result: 'typo' };
  }

  return {
    result: 'incorrect',
    displayAnswer: closest.original,
  };
}
