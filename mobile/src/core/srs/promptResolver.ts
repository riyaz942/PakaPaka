import { hasKanji } from '@/core/answer/scriptDetection';

export type PromptType = 'reading' | 'meaning' | 'production';

export type ItemTypeForPrompt = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

/**
 * The prompt for a single-card item. Both two-card types — kanji (meaning +
 * on'yomi) and vocabulary with a live reading card — are expanded by the queue
 * builder, which sets the prompt on each card explicitly.
 *
 * Vocabulary no longer alternates by rep parity: under v2 rule 2 a word is
 * either meaning-only or a meaning + reading pair, and this resolver only ever
 * sees the meaning-only side of that.
 */
export function resolvePromptType(itemType: ItemTypeForPrompt): PromptType {
  if (itemType === 'grammar') return 'production';
  return 'meaning';
}

/**
 * v2 rule 1 — a vocabulary item is asked for its reading only once every kanji
 * in it has reached guru. `unlearnedKanji` is the shortfall (see
 * `getUnlearnedKanjiForItems`); empty means every kanji is learned.
 *
 * Kana-only vocabulary never gets a reading card: its reading is identical to
 * its surface form, so asking for it is "type what you see".
 */
export function isVocabularyReadingUnlocked(
  primaryForm: string,
  unlearnedKanji: readonly string[],
): boolean {
  if (!hasKanji(primaryForm)) return false;
  return unlearnedKanji.length === 0;
}
