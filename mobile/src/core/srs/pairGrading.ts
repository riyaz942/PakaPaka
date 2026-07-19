import type { ReviewGrade } from './srs.types';

/**
 * Worst-of-both grade for a two-card kanji item (FR83): Again on either card
 * drags the pair to Again; a Hard card (hint-assisted, Story 5.4) caps the
 * pair at Hard; otherwise the pair takes the lower of the two clean grades.
 * Numeric min is exactly that ordering because ReviewGrade runs worst → best
 * (1=Again … 4=Easy).
 */
export function combinePairGrades(a: ReviewGrade, b: ReviewGrade): ReviewGrade {
  return Math.min(a, b) as ReviewGrade;
}
