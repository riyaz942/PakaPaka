export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export const JLPT_LEVELS: readonly JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export function isJlptLevel(value: string): value is JLPTLevel {
  return (JLPT_LEVELS as readonly string[]).includes(value);
}

export type RadicalItem = {
  id: string;
  slug: string;
  primaryForm: string;
  meaning: string;
  mnemonicText: string | null;
  visualMnemonicUrl: string | null;
  sortOrder: number;
};
