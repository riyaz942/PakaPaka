import { hasKanji } from '@/core/answer/scriptDetection';

import type { SRSState } from './srs.types';

export type PromptType = 'reading' | 'meaning' | 'production';

export type ItemTypeForPrompt = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export function resolvePromptType(
  itemType: ItemTypeForPrompt,
  srsState: SRSState,
  primaryForm: string,
): PromptType {
  if (itemType === 'radical') return 'meaning';
  if (itemType === 'grammar') return 'production';
  // Kanji never alternate by parity: every due kanji gets both a meaning card
  // and an on'yomi reading card, emitted by the queue builder (Story 1.1).
  // This resolver only covers the meaning-only edge (kanji with no on'yomi).
  if (itemType === 'kanji') return 'meaning';
  // Kana-only vocabulary has a reading identical to its surface form —
  // asking for it is "type what you see", so only ever prompt for meaning.
  if (!hasKanji(primaryForm)) return 'meaning';
  // vocabulary alternates by rep parity; guard against negative reps from data layer
  const parity = Math.abs(srsState.reps) % 2;
  return parity === 0 ? 'reading' : 'meaning';
}
