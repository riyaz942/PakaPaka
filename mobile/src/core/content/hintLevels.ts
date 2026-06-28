import type { ReinforcementLink } from '@/core/content/content.types';

export type HintLevel = {
  content: string;
  /** Final cross-domain level uses reinforcement styling */
  isReinforcement?: boolean;
};

/**
 * Builds progressive hint levels for grammar items.
 * Empty levels are omitted — hint count reflects only available levels.
 */
export function buildGrammarHintLevels(input: {
  structure?: string | null;
  meaning?: string | null;
  reinforcementLink?: ReinforcementLink | null;
}): HintLevel[] {
  const levels: HintLevel[] = [];

  if (input.structure?.trim()) {
    levels.push({ content: input.structure.trim() });
  }

  if (input.meaning?.trim()) {
    levels.push({ content: `Grammar point: ${input.meaning.trim()}` });
  }

  if (input.reinforcementLink?.displayText) {
    levels.push({
      content: input.reinforcementLink.displayText,
      isReinforcement: true,
    });
  }

  return levels;
}
