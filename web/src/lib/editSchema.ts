import type { ContentType } from '../types/api';

export type ItemFieldKind = 'text' | 'textarea' | 'number' | 'boolean' | 'stringArray' | 'json';

/**
 * `readOnly` marks a field with no sidecar behind it: it is rebuilt by
 * curriculum/_build/generate.py from the Python datasets (or derived, like
 * example furigana), so an edit made here would be destroyed by the next
 * generate run. The server refuses those edits — see server/curriculum/
 * sidecar.ts, which is the authority; this flag keeps the form from offering
 * them in the first place.
 */
export type ItemFieldSpec = {
  key: string;
  label: string;
  kind: ItemFieldKind;
  readOnly?: true;
};

type FieldBase = { readOnly?: true };

export type FieldSpec = FieldBase &
  (
    | { key: string; label: string; kind: 'text' | 'textarea' | 'number' | 'stringArray' | 'json' }
    | { key: string; label: string; kind: 'select'; options: string[] }
    | { key: string; label: string; kind: 'objectArray'; itemFields: ItemFieldSpec[] }
  );

/** Where a type's read-only fields are actually authored. */
export const GENERATED_FIELD_NOTE: Record<ContentType, string> = {
  radical: 'Locked fields come from curriculum/_build/{n5,n4}_radicals.py (or skeleton.json) and are rebuilt by generate.py.',
  kanji: 'Locked fields come from curriculum/_build/{n5,n4}_kanji.py (or skeleton.json) and are rebuilt by generate.py.',
  vocabulary: 'Locked fields come from curriculum/_build/{n5,n4}_vocab.py (or vocab_skeleton.json) and are rebuilt by generate.py.',
  grammar: 'Grammar is rebuilt from curriculum/_build/{n5,n4}_grammar.py and curriculum/grammar/lessons/<slug>.md — edit those files, not this form.',
  reading: 'Reading passages are rebuilt from curriculum/_build/{n5,n4}_readings.py — edit that dataset, not this form.',
};

const acceptedAnswerFields: ItemFieldSpec[] = [
  { key: 'answer_type', label: 'Type', kind: 'text', readOnly: true },
  { key: 'answer_text', label: 'Text', kind: 'text', readOnly: true },
  { key: 'is_primary', label: 'Primary', kind: 'boolean', readOnly: true },
];

const exampleSentenceFields: ItemFieldSpec[] = [
  { key: 'japanese', label: 'Japanese', kind: 'text' },
  { key: 'furigana', label: 'Furigana', kind: 'text', readOnly: true },
  { key: 'english', label: 'English', kind: 'text' },
  { key: 'sort_order', label: 'Sort order', kind: 'number', readOnly: true },
  { key: 'reinforcement_tags', label: 'Reinforcement tags', kind: 'stringArray', readOnly: true },
  { key: 'vocabulary_slugs', label: 'Vocabulary slugs', kind: 'stringArray' },
  { key: 'word_spans', label: 'Word spans (raw JSON)', kind: 'json', readOnly: true },
];

/** Per-type editable field lists. `slug` is intentionally excluded: it is the
 * lookup key for saves and is referenced by dependencies/graph.json, which
 * this tool never rewrites (renames would create dangling edges). `_meta` is
 * edited separately via the one-click review-status control. */
export const EDIT_SCHEMAS: Record<ContentType, FieldSpec[]> = {
  radical: [
    { key: 'primary_form', label: 'Primary form', kind: 'text', readOnly: true },
    { key: 'meaning', label: 'Meaning', kind: 'text', readOnly: true },
    { key: 'mnemonic_text', label: 'Mnemonic', kind: 'textarea' },
    { key: 'image_prompt', label: 'Image mnemonic (art prompt)', kind: 'textarea', readOnly: true },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'visual_mnemonic_url', label: 'Visual mnemonic URL', kind: 'text', readOnly: true },
    { key: 'visually_similar_slugs', label: 'Visually similar slugs', kind: 'stringArray', readOnly: true },
    { key: 'accepted_answers', label: 'Accepted answers', kind: 'objectArray', readOnly: true, itemFields: acceptedAnswerFields },
  ],
  kanji: [
    { key: 'primary_form', label: 'Primary form', kind: 'text', readOnly: true },
    { key: 'meaning', label: 'Meaning', kind: 'text', readOnly: true },
    { key: 'meaning_mnemonic', label: 'Meaning mnemonic', kind: 'textarea' },
    { key: 'reading_mnemonic', label: 'Reading mnemonic', kind: 'textarea' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'visually_similar_slugs', label: 'Visually similar slugs', kind: 'stringArray', readOnly: true },
    {
      key: 'readings',
      label: 'Readings',
      kind: 'objectArray',
      readOnly: true,
      itemFields: [
        { key: 'reading_type', label: 'Type (onyomi/kunyomi)', kind: 'text', readOnly: true },
        { key: 'reading', label: 'Reading', kind: 'text', readOnly: true },
        { key: 'sort_order', label: 'Sort order', kind: 'number', readOnly: true },
      ],
    },
    { key: 'accepted_answers', label: 'Accepted answers', kind: 'objectArray', readOnly: true, itemFields: acceptedAnswerFields },
    { key: 'example_sentences', label: 'Example sentences', kind: 'objectArray', itemFields: exampleSentenceFields },
  ],
  vocabulary: [
    { key: 'primary_form', label: 'Primary form', kind: 'text', readOnly: true },
    { key: 'furigana', label: 'Furigana', kind: 'text', readOnly: true },
    { key: 'meaning', label: 'Meaning', kind: 'text', readOnly: true },
    { key: 'meaning_mnemonic', label: 'Meaning mnemonic', kind: 'textarea' },
    { key: 'reading_mnemonic', label: 'Reading mnemonic', kind: 'textarea' },
    { key: 'description', label: 'Description', kind: 'textarea' },
    { key: 'accepted_answers', label: 'Accepted answers', kind: 'objectArray', readOnly: true, itemFields: acceptedAnswerFields },
    { key: 'example_sentences', label: 'Example sentences', kind: 'objectArray', itemFields: exampleSentenceFields },
  ],
  grammar: [
    { key: 'primary_form', label: 'Primary form', kind: 'text', readOnly: true },
    { key: 'meaning', label: 'Meaning', kind: 'text', readOnly: true },
    { key: 'structure', label: 'Structure', kind: 'text', readOnly: true },
    {
      key: 'uses',
      label: 'Uses',
      kind: 'objectArray',
      readOnly: true,
      itemFields: [
        { key: 'label', label: 'Label', kind: 'text', readOnly: true },
        { key: 'structure', label: 'Structure', kind: 'text', readOnly: true },
        { key: 'japanese', label: 'Japanese', kind: 'text', readOnly: true },
        { key: 'furigana', label: 'Furigana', kind: 'text', readOnly: true },
        { key: 'english', label: 'English', kind: 'text', readOnly: true },
      ],
    },
    {
      key: 'family',
      label: 'Family',
      kind: 'select',
      readOnly: true,
      options: ['particles', 'copula', 'conjugations', 'connectors', 'patterns'],
    },
    { key: 'explanation_markdown', label: 'Explanation (Markdown)', kind: 'textarea', readOnly: true },
    { key: 'caution_notes', label: 'Caution notes', kind: 'stringArray', readOnly: true },
    { key: 'related_grammar_slugs', label: 'Related grammar slugs', kind: 'stringArray', readOnly: true },
    { key: 'vocabulary_slugs', label: 'Vocabulary slugs', kind: 'stringArray', readOnly: true },
    { key: 'accepted_forms', label: 'Accepted forms', kind: 'stringArray', readOnly: true },
    { key: 'conjugation_rules', label: 'Conjugation rules (raw JSON)', kind: 'json', readOnly: true },
    {
      key: 'cloze_variants',
      label: 'Cloze variants',
      kind: 'objectArray',
      readOnly: true,
      itemFields: [
        { key: 'jp_cloze', label: 'Japanese cloze', kind: 'text', readOnly: true },
        { key: 'jp_cloze_furigana', label: 'Furigana cloze', kind: 'text', readOnly: true },
        { key: 'english', label: 'English', kind: 'text', readOnly: true },
        { key: 'answer', label: 'Answer', kind: 'text', readOnly: true },
        { key: 'nudge', label: 'Nudge', kind: 'textarea', readOnly: true },
        { key: 'sort_order', label: 'Sort order', kind: 'number', readOnly: true },
      ],
    },
    { key: 'example_sentences', label: 'Example sentences', kind: 'objectArray', readOnly: true, itemFields: exampleSentenceFields },
  ],
  reading: [
    { key: 'title', label: 'Title', kind: 'text', readOnly: true },
    { key: 'body', label: 'Body', kind: 'textarea', readOnly: true },
    { key: 'body_furigana', label: 'Body (furigana)', kind: 'textarea', readOnly: true },
    { key: 'english_translation', label: 'English translation', kind: 'textarea', readOnly: true },
    { key: 'summary_ja', label: 'Summary (Japanese)', kind: 'textarea', readOnly: true },
    { key: 'summary_en', label: 'Summary (English)', kind: 'textarea', readOnly: true },
    { key: 'grammar_slugs', label: 'Grammar slugs', kind: 'stringArray', readOnly: true },
    { key: 'vocabulary_slugs', label: 'Vocabulary slugs', kind: 'stringArray', readOnly: true },
    { key: 'word_spans', label: 'Word spans (raw JSON)', kind: 'json', readOnly: true },
    {
      key: 'questions',
      label: 'Questions',
      kind: 'objectArray',
      readOnly: true,
      itemFields: [
        { key: 'prompt', label: 'Prompt', kind: 'text', readOnly: true },
        { key: 'prompt_furigana', label: 'Prompt (furigana)', kind: 'text', readOnly: true },
        { key: 'accepted_answers', label: 'Accepted answers', kind: 'stringArray', readOnly: true },
        { key: 'sort_order', label: 'Sort order', kind: 'number', readOnly: true },
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
