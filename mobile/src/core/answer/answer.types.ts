export type AnswerResult = 'correct' | 'incorrect' | 'typo' | 'wrong_script';

export type EvaluationResult = {
  result: AnswerResult;
  /** Primary accepted answer to display on incorrect */
  displayAnswer?: string;
};
