/** Shapes of the `raw` field on ItemDetailResponse, mirroring curriculum/schema/curriculum.schema.json $defs. */

export type SidecarMetaRaw = {
  generator_model?: string;
  prompt_version?: string;
  review_status?: 'draft' | 'reviewed' | 'flagged_for_rewrite';
  reviewed_by?: string;
};

export type AcceptedAnswer = {
  answer_type: 'meaning' | 'reading' | 'production';
  answer_text: string;
  is_primary?: boolean;
};

export type KanjiReading = {
  reading_type: 'onyomi' | 'kunyomi';
  reading: string;
  sort_order?: number;
};

export type WordSpan = {
  vocabulary_slug: string;
  start: number;
  end: number;
  surface_form?: string;
  inflection?: 'masu' | 'te' | 'nai' | 'ta';
};

export type ExampleSentence = {
  japanese: string;
  furigana?: string;
  english: string;
  sort_order?: number;
  reinforcement_tags?: string[];
  vocabulary_slugs?: string[];
  word_spans?: WordSpan[];
};

export type GrammarClozeVariant = {
  jp_cloze: string;
  jp_cloze_furigana?: string;
  english: string;
  answer: string;
  nudge?: string;
  sort_order?: number;
};

export type PassageQuestion = {
  prompt: string;
  prompt_furigana?: string;
  accepted_answers: string[];
  sort_order?: number;
};

export type RadicalRaw = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  image_prompt?: string;
  description?: string;
  visually_similar_slugs?: string[];
  visual_mnemonic_url: string;
  sort_order?: number;
  accepted_answers?: AcceptedAnswer[];
  _meta?: SidecarMetaRaw;
};

export type KanjiRaw = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
  description?: string;
  visually_similar_slugs?: string[];
  sort_order?: number;
  readings?: KanjiReading[];
  accepted_answers?: AcceptedAnswer[];
  example_sentences?: ExampleSentence[];
  _meta?: SidecarMetaRaw;
};

export type VocabRaw = {
  slug: string;
  primary_form: string;
  furigana?: string;
  meaning: string;
  /** Part of speech ("い adjective", "adverb, noun"). Absent on the compound
      forms taught as grammar, which have no single part of speech. */
  word_type?: string;
  reading_composition?: string;
  mnemonic_text?: string;
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
  description?: string;
  sort_order?: number;
  accepted_answers?: AcceptedAnswer[];
  example_sentences?: ExampleSentence[];
  _meta?: SidecarMetaRaw;
};

export type GrammarRaw = {
  slug: string;
  primary_form: string;
  meaning: string;
  explanation_markdown?: string;
  caution_notes?: string[];
  related_grammar_slugs?: string[];
  sort_order?: number;
  structure: string;
  conjugation_rules: Record<string, unknown>;
  accepted_forms: string[];
  family?: 'particles' | 'copula' | 'conjugations' | 'connectors' | 'patterns';
  cloze_variants?: GrammarClozeVariant[];
  example_sentences?: ExampleSentence[];
  vocabulary_slugs?: string[];
  _meta?: SidecarMetaRaw;
};

export type ReadingRaw = {
  slug?: string;
  title: string;
  body: string;
  body_furigana?: string;
  english_translation?: string;
  summary_ja?: string;
  summary_en?: string;
  word_spans?: WordSpan[];
  grammar_slugs?: string[];
  vocabulary_slugs?: string[];
  word_count?: number;
  sort_order?: number;
  questions?: PassageQuestion[];
  _meta?: SidecarMetaRaw;
};
