export type AnswerResult =
  | 'correct'
  | 'incorrect'
  | 'typo'
  | 'wrong_script'
  | 'wrong_reading_type';

export type EvaluationResult = {
  result: AnswerResult;
  /** Primary accepted answer to display on incorrect */
  displayAnswer?: string;
  /**
   * Grammar near-miss (Plan 10): the answer contained the right chunk but more
   * than the blank wants. Still incorrect for SRS; drives teaching copy only.
   */
  feedbackKind?: 'incomplete';
};
