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
  source: GrammarClozeSource;
};

export type GrammarClozeInput = {
  /** Example sentences in display order; the first blankable one wins. */
  exampleSentences: { japanese: string }[];
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
      return { prompt, source: 'example' };
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
    return { prompt: tokens.join(' + '), source: 'structure' };
  }

  for (const form of forms) {
    const index = structure.indexOf(form);
    if (index === -1) continue;
    return {
      prompt: structure.slice(0, index) + CLOZE_BLANK + structure.slice(index + form.length),
      source: 'structure',
    };
  }

  return { prompt: structure, source: 'structure' };
}
