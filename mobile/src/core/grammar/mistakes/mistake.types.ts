import type { ConjugationClass, ConjugationForm } from '@/core/content/conjugation';

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

export type UnitForm = ConjugationForm | 'te';
export type FormDims = {
  register?: 'polite' | 'plain';
  tense?: 'past' | 'non-past';
  polarity?: 'negative' | 'positive';
};
export type VariantKind =
  | 'particle_wrong'
  | 'form'
  | 'verb_group'
  | 'te_ta'
  | 'adjective_type'
  | 'transitivity'
  | 'homophone_kanji'
  | 'spelling_sokuon'
  | 'spelling_long_vowel';

/** A known wrong form of an answer unit. `dims` = the variant's own values where it differs from the unit's form. */
export type UnitVariant = { text: string; kind: VariantKind; dims?: FormDims; dictForm?: string };

export type StepKind = 'exact' | 'allowed' | VariantKind | 'missing' | 'extra' | 'replaced';
/** One alignment step. `from`/`to` are offsets in the normalized input (from === to for a missing unit). unitIndex is null for 'extra'. */
export type AlignStep = {
  kind: StepKind;
  unitIndex: number | null;
  from: number;
  to: number;
  variant?: UnitVariant;
};
export type Alignment = { steps: AlignStep[]; cost: number };
