import { CLOZE_BLANK } from './clozeBuilder';

/**
 * Near-miss classification for grammar cloze answers (Plan 10).
 *
 * "Incomplete" is the WK-style honesty case: the learner knew the grammar but
 * typed more than the blank wants (`私は` or a full sentence when the blank is
 * just `は`). It still grades incorrect for SRS — the contract is chunk-only —
 * but the UI acknowledges the intent instead of a flat ✗.
 *
 * A different chunk of the same length (は vs が) is a plain wrong answer,
 * never a near miss.
 */
export type GrammarNearMiss = 'none' | 'incomplete';

export type GrammarNearMissContext = {
  /** Chunks the evaluator accepts (answerKey.grammar.acceptedForms / variant answer first). */
  acceptedForms: string[];
};

function normalize(value: string): string {
  return value.normalize('NFKC').trim();
}

export function assessGrammarNearMiss(
  userAnswer: string,
  context: GrammarNearMissContext,
): GrammarNearMiss {
  const answer = normalize(userAnswer);
  if (!answer) return 'none';

  const forms = context.acceptedForms
    .map(normalize)
    .filter((form) => form.length > 0);

  for (const form of forms) {
    // Exactly the chunk would have been correct; equal-length mismatch is a
    // plain wrong answer. Only a *longer* answer containing the chunk counts —
    // this also covers typing/pasting the full unclozed sentence.
    if (answer.length > form.length && answer.includes(form)) {
      return 'incomplete';
    }
  }

  return 'none';
}

/** The completed sentence (cloze with the answer filled in), for reveal copy. */
export function resolveCompletedSentence(
  clozePrompt: string | null | undefined,
  answer: string,
): string | null {
  if (!clozePrompt || !clozePrompt.includes(CLOZE_BLANK)) return null;
  return clozePrompt.replace(CLOZE_BLANK, answer);
}
