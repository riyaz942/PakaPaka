/**
 * Grammar cloze derivation (Plan 07 — grammar cloze contract).
 *
 * Grammar reviews must test placement in context, never "type what you see":
 * the prompt is a JP sentence (or structure frame) with the grammar chunk
 * blanked out, and the answer is graded against the chunk only. This module
 * derives that cloze from existing example sentences until authored `jp_cloze`
 * content lands (Plan 09).
 */

export const CLOZE_BLANK = '＿＿＿';

export type GrammarClozeSource = 'example' | 'structure';

export type GrammarCloze = {
  /** Sentence or structure frame with the grammar chunk replaced by CLOZE_BLANK. */
  prompt: string;
  /**
   * Furigana-annotated prompt (bracket notation, blank preserved) when derived
   * from an annotated example. Null for structure frames / unannotated sources.
   */
  promptFurigana: string | null;
  source: GrammarClozeSource;
};

export type GrammarClozeInput = {
  /** Example sentences in display order; the first blankable one wins. */
  exampleSentences: { japanese: string; furigana?: string | null }[];
  /** Accepted grammar forms — the gradeable chunks (e.g. ["てください", "でください"]). */
  acceptedForms: string[];
  /** Structure frame fallback, e.g. "Noun + は + comment". */
  structure?: string | null;
};

/**
 * Forms containing 〜 are discontinuous templates ("まだ〜ていない") that never
 * occur literally in a sentence; blanking a fragment of one would desync the
 * visible blank from what the evaluator accepts, so they are never matched.
 */
function blankableForms(acceptedForms: string[]): string[] {
  return acceptedForms
    .filter((form) => form.length > 0 && !form.includes('〜'))
    // Longest-match wins so multi-mora forms (てください) beat their prefixes (て).
    .sort((a, b) => b.length - a.length);
}

/**
 * Replace the first surface occurrence of `form` in a furigana-annotated
 * string (text outside `[...]` reading brackets) with `replacement`.
 * Returns null when the form is not found on the surface.
 */
export function blankFormInFurigana(
  annotated: string,
  form: string,
  replacement: string = CLOZE_BLANK,
): string | null {
  if (!annotated || !form) return null;

  // Map each surface character to its index in the annotated string.
  const surfaceIndexes: number[] = [];
  let inBracket = false;
  for (let i = 0; i < annotated.length; i++) {
    const ch = annotated[i];
    if (ch === '[') {
      inBracket = true;
      continue;
    }
    if (ch === ']') {
      inBracket = false;
      continue;
    }
    if (!inBracket) surfaceIndexes.push(i);
  }

  const surface = surfaceIndexes.map((i) => annotated[i]).join('');
  const index = surface.indexOf(form);
  if (index === -1) return null;

  const start = surfaceIndexes[index];
  let end = surfaceIndexes[index + form.length - 1] + 1;
  // Consume a trailing `[reading]` that belongs to the last blanked character.
  if (annotated[end] === '[') {
    const close = annotated.indexOf(']', end);
    if (close !== -1) end = close + 1;
  }

  return annotated.slice(0, start) + replacement + annotated.slice(end);
}

/**
 * Derives a cloze prompt for a grammar item, or null when nothing safe exists.
 *
 * Order of preference:
 * 1. First example sentence containing an accepted form → blank that chunk.
 * 2. Structure frame with the matching token (or substring) blanked.
 * 3. Bare structure frame — a frame is descriptive, never the answer itself.
 *
 * Never returns a prompt equal to an accepted form (the tautology this plan
 * exists to kill).
 */
export function buildGrammarCloze(input: GrammarClozeInput): GrammarCloze | null {
  const forms = blankableForms(input.acceptedForms);

  for (const sentence of input.exampleSentences) {
    for (const form of forms) {
      const index = sentence.japanese.indexOf(form);
      if (index === -1) continue;
      const prompt =
        sentence.japanese.slice(0, index) +
        CLOZE_BLANK +
        sentence.japanese.slice(index + form.length);
      const promptFurigana = sentence.furigana
        ? blankFormInFurigana(sentence.furigana, form)
        : null;
      return { prompt, promptFurigana, source: 'example' };
    }
  }

  const structure = input.structure?.trim();
  if (!structure) return null;
  if (input.acceptedForms.includes(structure)) return null;

  // Token-level blank first ("Noun + は + comment" → "Noun + ＿＿＿ + comment")
  // so a particle inside another token is not mangled.
  const tokens = structure.split('+').map((token) => token.trim());
  const tokenIndex = tokens.findIndex((token) => input.acceptedForms.includes(token));
  if (tokenIndex !== -1) {
    tokens[tokenIndex] = CLOZE_BLANK;
    return { prompt: tokens.join(' + '), promptFurigana: null, source: 'structure' };
  }

  for (const form of forms) {
    const index = structure.indexOf(form);
    if (index === -1) continue;
    return {
      prompt: structure.slice(0, index) + CLOZE_BLANK + structure.slice(index + form.length),
      promptFurigana: null,
      source: 'structure',
    };
  }

  return { prompt: structure, promptFurigana: null, source: 'structure' };
}
