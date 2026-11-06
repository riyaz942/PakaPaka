/**
 * The taught inflections the curriculum pipeline derives spans for (14.1a).
 *
 * Deliberately not the full godan/ichidan paradigm: recognition is scoped to
 * the forms N5/N4 grammar actually teaches, which is what the learner can be
 * expected to recognise and what the compiled spans carry.
 */
export type WordInflection = 'masu' | 'te' | 'nai' | 'ta';

/** Teaching order, used to list a word's taught forms deterministically. */
export const WORD_INFLECTIONS: readonly WordInflection[] = ['masu', 'te', 'nai', 'ta'];

/**
 * Learner-facing name for each category. `masu` covers the polite negative and
 * past too (ません / ました / ませんでした), hence the doubled label.
 */
export const INFLECTION_LABEL: Record<WordInflection, string> = {
  masu: 'polite / ます-form',
  te: 'て-form',
  nai: 'ない-form',
  ta: 'た-form',
};

/** Narrows a route query param to a taught inflection; null for anything else. */
export function parseInflection(value: string | undefined | null): WordInflection | null {
  return WORD_INFLECTIONS.find((inflection) => inflection === value) ?? null;
}

/**
 * The hero note shown when a learner arrives at a word from a conjugated
 * surface — "来ます is the polite / ます-form of 来る" (14.1).
 *
 * Null when there is nothing to say: no surface, or the surface *is* the
 * dictionary form the page already heroes.
 */
export function conjugatedFormNote(
  surface: string | null,
  baseForm: string,
  inflection: WordInflection | null,
): string | null {
  if (!surface || surface === baseForm) {
    return null;
  }
  // The pipeline tags なくて / ないで as `nai`; name the table's negative て-form instead.
  if (inflection === 'nai' && (surface.endsWith('なくて') || surface.endsWith('ないで'))) {
    return `${surface} is the negative て-form of ${baseForm}`;
  }
  return inflection
    ? `${surface} is the ${INFLECTION_LABEL[inflection]} of ${baseForm}`
    : `${surface} is a conjugated form of ${baseForm}`;
}
