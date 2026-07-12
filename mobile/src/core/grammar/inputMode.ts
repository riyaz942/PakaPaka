import type { SRSStageLabel } from '@/core/srs/srs.types';

/**
 * Stage-based grammar difficulty ladder (Plan 08).
 *
 * Difficulty scales the *input mode and scaffolding*, never the task type —
 * the prompt is always the same JP cloze (Plan 07):
 *
 * - Apprentice: multiple choice with same-family distractors.
 * - Guru / Master: type-in of the grammar chunk.
 * - Enlightened+ (incl. burned): type-in with no English scaffolding.
 */
export type GrammarInputMode = 'mc' | 'type_in';

export function resolveGrammarInputMode(stage: SRSStageLabel): GrammarInputMode {
  return stage === 'apprentice' ? 'mc' : 'type_in';
}

/**
 * Enlightened scaffolding gate, shared by the hint builder (Plan 10) and any
 * on-card copy: at Enlightened+ the English meaning must not be revealable.
 * Burned items shouldn't be in the queue, but if one is, treat it the same.
 */
export function englishHintsAllowed(stage: SRSStageLabel): boolean {
  return stage !== 'enlightened' && stage !== 'burned';
}
