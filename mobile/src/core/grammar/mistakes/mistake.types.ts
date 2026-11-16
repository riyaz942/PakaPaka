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
  | 'spelling_long_vowel'
  | 'spelling_typo';

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

export type MistakeKind =
  | 'particle_missing'
  | 'particle_wrong'
  | 'particle_extra'
  | Exclude<VariantKind, 'particle_wrong'>
  | 'grammar_not_used'
  | 'wrong_word'
  | 'word_missing'
  | 'word_extra'
  | 'word_order';
/** One mistake in a Build answer. Offsets are in the raw input; rawStart === rawEnd for a gap. */
export type Mistake = {
  kind: MistakeKind;
  rawStart: number;
  rawEnd: number;
  typed: string; // raw input slice ('' for a gap)
  expected: string[]; // correct text(s) at this place, answer surface; [] for word_extra / word_order
  before: string | null; // learner's raw text right before the mark (any step with text)
  after: string | null; // learner's raw text right after the mark (any step with text)
  dims?: FormDims; // the answer form's values on the dimensions the learner got wrong
  dictForm?: string;
  conjugationClass?: ConjugationClass; // of the answer word (verb_group, adjective_type)
  transitivity?: 'transitive' | 'intransitive'; // of the verb the answer needs
};
/** marks = mistakes with a place; lines = mistakes with no single place (word order, grammar not used). */
export type BuildDiagnosis = { marks: Mistake[]; lines: Mistake[] };
