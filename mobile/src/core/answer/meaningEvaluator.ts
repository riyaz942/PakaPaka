import type { EvaluationResult } from '@/core/answer/answer.types';

import { levenshtein } from './levenshtein';

/** Length-scaled typo threshold (WaniKani-style fat-finger tolerance). */
export function meaningTypoThreshold(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

export function normalizeMeaning(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Expands a display meaning string into individual accepted answers.
 * Curriculum `meaning` fields pack alternatives ("hole / cave",
 * "at / by / with (place of action, means)") — each alternative is accepted,
 * with and without its trailing parenthetical qualifier.
 */
export function deriveMeaningCandidates(meaning: string): string[] {
  const candidates = new Set<string>();
  const trimmed = meaning.trim();
  if (!trimmed) return [];

  candidates.add(trimmed);
  // Qualifiers may contain '/' or ',' themselves, so drop them before splitting.
  const withoutQualifiers = trimmed.replace(/\s*\([^)]*\)/g, ' ').trim();
  if (withoutQualifiers) {
    candidates.add(withoutQualifiers);
  }
  for (const source of [trimmed, withoutQualifiers]) {
    for (const part of source.split(/[/;]/)) {
      const alternative = part.replace(/\s+/g, ' ').trim();
      if (alternative) {
        candidates.add(alternative);
      }
    }
  }
  return [...candidates];
}

export function evaluateMeaning(
  userAnswer: string,
  acceptedMeanings: string[],
): EvaluationResult {
  const normalized = normalizeMeaning(userAnswer);
  if (!normalized) {
    return { result: 'incorrect', displayAnswer: acceptedMeanings[0] };
  }

  const accepted = acceptedMeanings
    .map(normalizeMeaning)
    .filter((m) => m.length > 0);

  if (accepted.length === 0) {
    return { result: 'incorrect' };
  }

  for (const candidate of accepted) {
    if (normalized === candidate) {
      return { result: 'correct' };
    }
  }

  let closest = accepted[0];
  let minDistance = Infinity;
  for (const candidate of accepted) {
    const distance = levenshtein(normalized, candidate);
    if (distance < minDistance) {
      minDistance = distance;
      closest = candidate;
    }
  }

  const threshold = meaningTypoThreshold(closest.length);
  if (minDistance <= threshold && minDistance > 0) {
    return { result: 'typo' };
  }

  return { result: 'incorrect', displayAnswer: acceptedMeanings[0] };
}
