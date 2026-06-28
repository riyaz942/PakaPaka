import type { SRSState } from './srs.types';

export type PromptType = 'reading' | 'meaning' | 'production';

export type ItemTypeForPrompt = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export function resolvePromptType(itemType: ItemTypeForPrompt, srsState: SRSState): PromptType {
  if (itemType === 'radical') return 'meaning';
  if (itemType === 'grammar') return 'production';
  // kanji and vocabulary alternate by rep parity; guard against negative reps from data layer
  const parity = Math.abs(srsState.reps) % 2;
  return parity === 0 ? 'reading' : 'meaning';
}
