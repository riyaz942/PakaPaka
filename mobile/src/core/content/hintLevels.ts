import type { ReinforcementLink } from '@/core/content/content.types';

export type HintLevel = {
  content: string;
  /** Final cross-domain level uses reinforcement styling */
  isReinforcement?: boolean;
};

/**
 * Two-rung grammar hint ladder (Plan 10): nudge → English, plus an optional
 * reinforcement link. Revealing hints never affects the FSRS grade.
 *
 * The English rung (and the reinforcement rung, which can leak meaning) is
 * dropped entirely when `englishAllowed` is false — the Enlightened+
 * scaffolding gate (Plan 08). Empty levels are omitted — hint count reflects
 * only available levels.
 */
export function buildGrammarHintLevels(input: {
  /** Rung 1: short pedagogical poke (authored nudge or structure frame). */
  nudge?: string | null;
  /** Rung 2: English sentence or meaning — gated by englishAllowed. */
  english?: string | null;
  englishAllowed: boolean;
  reinforcementLink?: ReinforcementLink | null;
}): HintLevel[] {
  const levels: HintLevel[] = [];

  if (input.nudge?.trim()) {
    levels.push({ content: input.nudge.trim() });
  }

  if (input.englishAllowed && input.english?.trim()) {
    levels.push({ content: input.english.trim() });
  }

  if (input.englishAllowed && input.reinforcementLink?.displayText) {
    levels.push({
      content: input.reinforcementLink.displayText,
      isReinforcement: true,
    });
  }

  return levels;
}
