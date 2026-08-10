import fs from 'node:fs';
import path from 'node:path';
import type { Completeness, ContentType } from './types.js';

type FieldCheck = {
  name: string;
  ok: (raw: Record<string, unknown>, assetsDir: string) => boolean;
};

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value: unknown, min = 1): boolean {
  return Array.isArray(value) && value.length >= min;
}

const CHECKLISTS: Record<ContentType, FieldCheck[]> = {
  radical: [
    { name: 'mnemonic_text', ok: (r) => isNonEmptyString(r.mnemonic_text) },
    { name: 'description', ok: (r) => isNonEmptyString(r.description) },
    { name: 'accepted_answers', ok: (r) => isNonEmptyArray(r.accepted_answers) },
    {
      name: 'visual_mnemonic_url',
      ok: (r, assetsDir) => {
        if (!isNonEmptyString(r.visual_mnemonic_url)) return false;
        const filePath = path.join(assetsDir, r.visual_mnemonic_url as string);
        return fs.existsSync(filePath);
      },
    },
  ],
  kanji: [
    { name: 'readings', ok: (r) => isNonEmptyArray(r.readings) },
    { name: 'accepted_answers', ok: (r) => isNonEmptyArray(r.accepted_answers) },
    { name: 'meaning_mnemonic', ok: (r) => isNonEmptyString(r.meaning_mnemonic) },
    { name: 'reading_mnemonic', ok: (r) => isNonEmptyString(r.reading_mnemonic) },
    { name: 'description', ok: (r) => isNonEmptyString(r.description) },
    { name: 'example_sentences', ok: (r) => isNonEmptyArray(r.example_sentences, 1) },
  ],
  vocabulary: [
    { name: 'furigana', ok: (r) => isNonEmptyString(r.furigana) },
    { name: 'accepted_answers', ok: (r) => isNonEmptyArray(r.accepted_answers) },
    { name: 'meaning_mnemonic', ok: (r) => isNonEmptyString(r.meaning_mnemonic) },
    { name: 'reading_mnemonic', ok: (r) => isNonEmptyString(r.reading_mnemonic) },
    { name: 'example_sentences', ok: (r) => isNonEmptyArray(r.example_sentences, 1) },
  ],
  grammar: [
    {
      name: 'explanation_markdown',
      ok: (r) => isNonEmptyString(r.explanation_markdown),
    },
    { name: 'caution_notes', ok: (r) => isNonEmptyArray(r.caution_notes) },
    { name: 'accepted_forms', ok: (r) => isNonEmptyArray(r.accepted_forms) },
    { name: 'cloze_variants', ok: (r) => isNonEmptyArray(r.cloze_variants, 1) },
    { name: 'example_sentences', ok: (r) => isNonEmptyArray(r.example_sentences, 1) },
  ],
  reading: [
    { name: 'body_furigana', ok: (r) => isNonEmptyString(r.body_furigana) },
    {
      name: 'english_translation',
      ok: (r) => isNonEmptyString(r.english_translation),
    },
    { name: 'summary_ja', ok: (r) => isNonEmptyString(r.summary_ja) },
    { name: 'summary_en', ok: (r) => isNonEmptyString(r.summary_en) },
    { name: 'word_spans', ok: (r) => isNonEmptyArray(r.word_spans) },
    { name: 'grammar_slugs', ok: (r) => isNonEmptyArray(r.grammar_slugs) },
    { name: 'vocabulary_slugs', ok: (r) => isNonEmptyArray(r.vocabulary_slugs) },
    { name: 'questions', ok: (r) => isNonEmptyArray(r.questions, 2) },
  ],
};

export function expectedFields(type: ContentType): string[] {
  return CHECKLISTS[type].map((c) => c.name);
}

export function computeCompleteness(
  type: ContentType,
  raw: Record<string, unknown>,
  assetsDir: string,
): Completeness {
  const checks = CHECKLISTS[type];
  const missing: string[] = [];
  let present = 0;

  for (const check of checks) {
    if (check.ok(raw, assetsDir)) {
      present += 1;
    } else {
      missing.push(check.name);
    }
  }

  const percent = checks.length === 0 ? 1 : present / checks.length;
  return { percent, missing };
}
