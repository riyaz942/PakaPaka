import type { ConjugationClass } from '@/core/content/conjugation';

export type AnswerUnitRole = 'word' | 'particle' | 'other';

/** One word / particle / other run of an accepted Build answer, cut at compile time. */
export type AnswerUnit = {
  surface: string;
  reading: string;
  role: AnswerUnitRole;
  itemId: string | null;
  inGrammar: boolean;
};

export type DiagnosisWordForm = {
  primaryForm: string;
  furigana: string | null;
  conjugationClass: ConjugationClass | null;
};

export type DiagnosisWord = DiagnosisWordForm & {
  itemId: string;
  transitivity: 'transitive' | 'intransitive' | null; // from items.word_type
  partner: DiagnosisWordForm | null; // items.transitivity_partner_id
  homophones: DiagnosisWordForm[]; // other vocabulary with the same reading, different primary_form
};

/** answers[0] = the sentence; then `valid` alternates in sort_order. */
export type BuildDiagnosisKey = { answers: AnswerUnit[][]; words: Record<string, DiagnosisWord> };
