export type GrammarAnswerContext = {
  conjugationRules: Record<string, unknown>;
  acceptedForms: string[];
};

export type ConjugationParseResult =
  | { status: 'correct' }
  | { status: 'incorrect'; displayAnswer: string }
  | { status: 'unsupported' };
