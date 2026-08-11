import type { ContentType } from '../types/api';

export type ItemFieldKind = 'text' | 'textarea' | 'number' | 'boolean' | 'stringArray' | 'json';

export type ItemFieldSpec = {
  key: string;
  label: string;
  kind: ItemFieldKind;
};

export type FieldSpec =
  | { key: string; label: string; kind: 'text' | 'textarea' | 'number' | 'stringArray' | 'json' }
  | { key: string; label: string; kind: 'select'; options: string[] }
  | { key: string; label: string; kind: 'objectArray'; itemFields: ItemFieldSpec[] };

const acceptedAnswerFields: ItemFieldSpec[] = [
  { key: 'answer_type', label: 'Type', kind: 'text' },
  { key: 'answer_text', label: 'Text', kind: 'text' },
  { key: 'is_primary', label: 'Primary', kind: 'boolean' },
];

const exampleSentenceFields: ItemFieldSpec[] = [
  { key: 'japanese', label: 'Japanese', kind: 'text' },
  { key: 'furigana', label: 'Furigana', kind: 'text' },
  { key: 'english', label: 'English', kind: 'text' },
  { key: 'sort_order', label: 'Sort order', kind: 'number' },
  { key: 'reinforcement_tags', label: 'Reinforcement tags', kind: 'stringArray' },
  { key: 'vocabulary_slugs', label: 'Vocabulary slugs', kind: 'stringArray' },
  { key: 'word_spans', label: 'Word spans (raw JSON)', kind: 'json' },
];

/** Per-type editable field lists. `slug` is intentionally excluded: it is the
 * lookup key for saves and is referenced by dependencies/graph.json, which
 * this tool never rewrites (renames would create dangling edges). `_meta` is
 * edited separately via the one-click review-status control. */
export const EDIT_SCHEMAS: Record<ContentType, FieldSpec[]> = {
  radical: [
    { key: 'primary_form', label: 'Primary form', kind: 'text' },
    { key: 'meaning', label: 'Meaning', kind: 'text' },
    { key: 'mnemonic_text', label: 'Mnemonic', kind: 'textarea' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'visual_mnemonic_url', label: 'Visual mnemonic URL', kind: 'text' },
    { key: 'visually_similar_slugs', label: 'Visually similar slugs', kind: 'stringArray' },
    { key: 'accepted_answers', label: 'Accepted answers', kind: 'objectArray', itemFields: acceptedAnswerFields },
  ],
  kanji: [
    { key: 'primary_form', label: 'Primary form', kind: 'text' },
    { key: 'meaning', label: 'Meaning', kind: 'text' },
    { key: 'meaning_mnemonic', label: 'Meaning mnemonic', kind: 'textarea' },
    { key: 'reading_mnemonic', label: 'Reading mnemonic', kind: 'textarea' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'visually_similar_slugs', label: 'Visually similar slugs', kind: 'stringArray' },
    {
      key: 'readings',
      label: 'Readings',
      kind: 'objectArray',
      itemFields: [
        { key: 'reading_type', label: 'Type (onyomi/kunyomi)', kind: 'text' },
        { key: 'reading', label: 'Reading', kind: 'text' },
        { key: 'sort_order', label: 'Sort order', kind: 'number' },
      ],
    },
    { key: 'accepted_answers', label: 'Accepted answers', kind: 'objectArray', itemFields: acceptedAnswerFields },
    { key: 'example_sentences', label: 'Example sentences', kind: 'objectArray', itemFields: exampleSentenceFields },
  ],
  vocabulary: [
    { key: 'primary_form', label: 'Primary form', kind: 'text' },
    { key: 'furigana', label: 'Furigana', kind: 'text' },
    { key: 'meaning', label: 'Meaning', kind: 'text' },
    { key: 'meaning_mnemonic', label: 'Meaning mnemonic', kind: 'textarea' },
    { key: 'reading_mnemonic', label: 'Reading mnemonic', kind: 'textarea' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'accepted_answers', label: 'Accepted answers', kind: 'objectArray', itemFields: acceptedAnswerFields },
    { key: 'example_sentences', label: 'Example sentences', kind: 'objectArray', itemFields: exampleSentenceFields },
  ],
  grammar: [
    { key: 'primary_form', label: 'Primary form', kind: 'text' },
    { key: 'meaning', label: 'Meaning', kind: 'text' },
    { key: 'structure', label: 'Structure', kind: 'text' },
    {
      key: 'family',
      label: 'Family',
      kind: 'select',
      options: ['particles', 'copula', 'conjugations', 'connectors', 'patterns'],
    },
    { key: 'explanation_markdown', label: 'Explanation (Markdown)', kind: 'textarea' },
    { key: 'caution_notes', label: 'Caution notes', kind: 'stringArray' },
    { key: 'related_grammar_slugs', label: 'Related grammar slugs', kind: 'stringArray' },
    { key: 'vocabulary_slugs', label: 'Vocabulary slugs', kind: 'stringArray' },
    { key: 'accepted_forms', label: 'Accepted forms', kind: 'stringArray' },
    { key: 'conjugation_rules', label: 'Conjugation rules (raw JSON)', kind: 'json' },
    {
      key: 'cloze_variants',
      label: 'Cloze variants',
      kind: 'objectArray',
      itemFields: [
        { key: 'jp_cloze', label: 'Japanese cloze', kind: 'text' },
        { key: 'jp_cloze_furigana', label: 'Furigana cloze', kind: 'text' },
        { key: 'english', label: 'English', kind: 'text' },
        { key: 'answer', label: 'Answer', kind: 'text' },
        { key: 'nudge', label: 'Nudge', kind: 'textarea' },
        { key: 'sort_order', label: 'Sort order', kind: 'number' },
      ],
    },
    { key: 'example_sentences', label: 'Example sentences', kind: 'objectArray', itemFields: exampleSentenceFields },
  ],
  reading: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'body', label: 'Body', kind: 'textarea' },
    { key: 'body_furigana', label: 'Body (furigana)', kind: 'textarea' },
    { key: 'english_translation', label: 'English translation', kind: 'textarea' },
    { key: 'summary_ja', label: 'Summary (Japanese)', kind: 'textarea' },
    { key: 'summary_en', label: 'Summary (English)', kind: 'textarea' },
    { key: 'grammar_slugs', label: 'Grammar slugs', kind: 'stringArray' },
    { key: 'vocabulary_slugs', label: 'Vocabulary slugs', kind: 'stringArray' },
    { key: 'word_spans', label: 'Word spans (raw JSON)', kind: 'json' },
    {
      key: 'questions',
      label: 'Questions',
      kind: 'objectArray',
      itemFields: [
        { key: 'prompt', label: 'Prompt', kind: 'text' },
        { key: 'prompt_furigana', label: 'Prompt (furigana)', kind: 'text' },
        { key: 'accepted_answers', label: 'Accepted answers', kind: 'stringArray' },
        { key: 'sort_order', label: 'Sort order', kind: 'number' },
      ],
    },
  ],
};

export function defaultForKind(kind: ItemFieldKind): unknown {
  switch (kind) {
    case 'text':
    case 'textarea':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'stringArray':
      return [];
    case 'json':
      return null;
  }
}
