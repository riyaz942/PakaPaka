export type AnswerResult =
  | 'correct'
  | 'incorrect'
  | 'typo'
  | 'wrong_script'
  | 'wrong_reading_type'
  /** Grammar Build: same meaning with a same-family grammar point (D6) — non-terminal, no grade. */
  | 'other_grammar'
  /** Grammar Build: 1–2 small slips (particle, conjugation, spelling) — non-terminal, no grade. */
  | 'close';

/**
 * Another curriculum item whose accepted answer matches what the user
 * submitted (FR86). Detection needs the curriculum DB, so it happens outside
 * the pure evaluator and annotates the reveal props — this is the single
 * collision representation for answer feedback (do not add a parallel one).
 */
export type AnswerCollision = {
  itemId: string;
  primaryForm: string;
};

export type EvaluationResult = {
  result: AnswerResult;
  /** Primary accepted answer to display on incorrect */
  displayAnswer?: string;
  /** `close` only: the one-line nudge ("~ Close! Check your particles."). */
  nudge?: string;
};
