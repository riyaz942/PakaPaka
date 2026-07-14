import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const CURRICULUM_DIR = path.join(REPO_ROOT, 'curriculum');
const SCHEMA_PATH = path.join(CURRICULUM_DIR, 'schema', 'curriculum.schema.json');


function resolveValidatorKey(relativePath: string): string {
  if (relativePath === 'metadata.json') {
    return 'metadata';
  }
  if (relativePath.startsWith('radicals/')) {
    return 'radicalsFile';
  }
  if (relativePath.startsWith('kanji/')) {
    return 'kanjiFile';
  }
  if (relativePath.startsWith('vocabulary/')) {
    return 'vocabularyFile';
  }
  if (relativePath.startsWith('grammar/')) {
    return 'grammarFile';
  }
  if (relativePath.startsWith('readings/')) {
    return 'readingsFile';
  }
  if (relativePath.startsWith('dependencies/')) {
    return 'dependenciesFile';
  }
  throw new Error(`No schema mapping for curriculum/${relativePath}`);
}

export type ValidateCurriculumResult =
  | { ok: true; fileCount: number; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const KANJI_RE = /[一-鿿]/;
const KANA_ONLY_RE = /^[぀-ヿ]*$/;
const BRACKET_RE = /\[[^[\]]*]/g;

/** Strips `[reading]` annotations, reproducing the plain (unannotated) string. */
export function stripFurigana(annotated: string): string {
  return annotated.replace(BRACKET_RE, '');
}

function extractReadings(annotated: string): string[] {
  const readings: string[] = [];
  const re = /\[([^[\]]*)]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(annotated))) {
    readings.push(match[1]);
  }
  return readings;
}

/**
 * True when every kanji character in `annotated` is covered by a `[reading]`
 * annotation — i.e. is part of the kanji run immediately preceding a bracket.
 * Warn-level per the furigana support plan: the corpus isn't fully annotated yet.
 */
function isKanjiFullyCovered(annotated: string): boolean {
  const covered = new Array<boolean>(annotated.length).fill(false);
  const bracketRe = /\[[^[\]]*]/g;
  let match: RegExpExecArray | null;
  while ((match = bracketRe.exec(annotated))) {
    let start = match.index;
    while (start > 0 && KANJI_RE.test(annotated[start - 1])) {
      start--;
    }
    for (let i = start; i < match.index; i++) {
      covered[i] = true;
    }
  }

  let inBracket = false;
  for (let i = 0; i < annotated.length; i++) {
    const ch = annotated[i];
    if (ch === '[') {
      inBracket = true;
      continue;
    }
    if (ch === ']') {
      inBracket = false;
      continue;
    }
    if (inBracket) {
      continue;
    }
    if (KANJI_RE.test(ch) && !covered[i]) {
      return false;
    }
  }
  return true;
}

function checkFuriganaField(
  label: string,
  plain: string,
  furigana: string | undefined,
  errors: string[],
  warnings: string[],
): void {
  if (furigana === undefined) {
    return;
  }

  const stripped = stripFurigana(furigana);
  if (stripped !== plain) {
    errors.push(
      `${label}: furigana strips to "${stripped}" but plain text is "${plain}"`,
    );
    return;
  }

  for (const reading of extractReadings(furigana)) {
    if (!KANA_ONLY_RE.test(reading)) {
      errors.push(`${label}: furigana reading "${reading}" is not kana-only`);
    }
  }

  if (!isKanjiFullyCovered(furigana)) {
    warnings.push(`${label}: not every kanji character is covered by a furigana annotation`);
  }
}

function runFuriganaChecks(
  validatorKey: string,
  relative: string,
  data: unknown,
  errors: string[],
  warnings: string[],
): void {
  if (validatorKey === 'vocabularyFile') {
    const file = data as { items: { slug: string; primary_form: string; furigana?: string }[] };
    for (const item of file.items) {
      checkFuriganaField(
        `${relative} vocabulary:${item.slug}`,
        item.primary_form,
        item.furigana,
        errors,
        warnings,
      );
    }
    return;
  }

  if (validatorKey === 'grammarFile') {
    const file = data as {
      items: {
        slug: string;
        accepted_forms: string[];
        related_grammar_slugs?: string[];
        cloze_variants?: { jp_cloze: string; answer: string }[];
        example_sentences?: { japanese: string; furigana?: string }[];
      }[];
    };
    for (const item of file.items) {
      for (const [index, sentence] of (item.example_sentences ?? []).entries()) {
        checkFuriganaField(
          `${relative} grammar:${item.slug} example[${index}]`,
          sentence.japanese,
          sentence.furigana,
          errors,
          warnings,
        );
      }
      runClozeVariantChecks(relative, item, errors);
      if ((item.related_grammar_slugs ?? []).includes(item.slug)) {
        errors.push(
          `${relative} grammar:${item.slug}: related_grammar_slugs must not reference the item itself`,
        );
      }
    }
    return;
  }

  if (validatorKey === 'readingsFile') {
    const file = data as {
      passages: {
        slug?: string;
        title: string;
        body: string;
        body_furigana?: string;
        questions?: { prompt: string; prompt_furigana?: string }[];
      }[];
    };
    for (const [index, passage] of file.passages.entries()) {
      const label = passage.slug ?? passage.title ?? `passage[${index}]`;
      checkFuriganaField(
        `${relative} passage:${label}`,
        passage.body,
        passage.body_furigana,
        errors,
        warnings,
      );
      for (const [qIndex, question] of (passage.questions ?? []).entries()) {
        checkFuriganaField(
          `${relative} passage:${label} question[${qIndex}]`,
          question.prompt,
          question.prompt_furigana,
          errors,
          warnings,
        );
      }
    }
  }
}

const CLOZE_BLANK_RE = /＿+/;

/**
 * Cloze variant consistency (Plan 09): the blank must be present and the
 * answer must be one of the item's accepted forms (NFKC-normalized), or the
 * review evaluator would reject the variant's own answer.
 */
function runClozeVariantChecks(
  relative: string,
  item: {
    slug: string;
    accepted_forms: string[];
    cloze_variants?: { jp_cloze: string; answer: string }[];
  },
  errors: string[],
): void {
  const accepted = new Set(item.accepted_forms.map((form) => form.normalize('NFKC')));
  for (const [index, variant] of (item.cloze_variants ?? []).entries()) {
    const label = `${relative} grammar:${item.slug} cloze_variants[${index}]`;
    if (!CLOZE_BLANK_RE.test(variant.jp_cloze)) {
      errors.push(`${label}: jp_cloze has no ＿ blank`);
    }
    if (!accepted.has(variant.answer.normalize('NFKC'))) {
      errors.push(
        `${label}: answer "${variant.answer}" is not in accepted_forms [${item.accepted_forms.join(', ')}]`,
      );
    }
  }
}

function resolveSchemaPath(curriculumDir: string): string {
  const localSchema = path.join(curriculumDir, 'schema', 'curriculum.schema.json');
  if (fs.existsSync(localSchema)) {
    return localSchema;
  }
  return SCHEMA_PATH;
}

export function validateCurriculum(
  curriculumDir: string = CURRICULUM_DIR,
): ValidateCurriculumResult {
  const schemaPath = resolveSchemaPath(curriculumDir);
  const schemaRaw = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const schemaId = (schemaRaw.$id as string) ?? 'curriculum.schema.json';
  ajv.addSchema(schemaRaw, schemaId);

  const defs = schemaRaw.$defs as Record<string, unknown> | undefined;
  if (!defs) {
    return { ok: false, errors: [`${schemaPath}: missing $defs`], warnings: [] };
  }

  const validators = new Map<string, ValidateFunction>();
  for (const key of Object.keys(defs)) {
    const validate = ajv.compile({ $ref: `${schemaId}#/$defs/${key}` });
    validators.set(key, validate);
  }

  const files = discoverJsonFilesIn(curriculumDir);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const filePath of files) {
    const relative = path.relative(curriculumDir, filePath);
    let validatorKey: string;
    try {
      validatorKey = resolveValidatorKey(relative);
    } catch (error) {
      errors.push(`${relative}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const validate = validators.get(validatorKey);
    if (!validate) {
      errors.push(`${relative}: schema definition "${validatorKey}" not found`);
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      errors.push(
        `${relative}: invalid JSON — ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (!validate(data)) {
      const messages = (validate.errors ?? [])
        .map((err) => `${err.instancePath || '/'}: ${err.message}`)
        .join('; ');
      errors.push(`${relative}: ${messages}`);
      continue;
    }

    runFuriganaChecks(validatorKey, relative, data, errors, warnings);
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, fileCount: files.length, warnings };
}

function discoverJsonFilesIn(curriculumDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // _build is the tooling workspace (datasets, importers, generation
        // drafts) — its JSON never ships and has no schema mapping.
        if (entry.name !== '_build') {
          walk(fullPath);
        }
        continue;
      }
      if (entry.name.endsWith('.json') && !fullPath.includes(`${path.sep}schema${path.sep}`)) {
        files.push(fullPath);
      }
    }
  }

  walk(curriculumDir);
  return files.sort();
}

function main(): void {
  const result = validateCurriculum();

  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }

  if (!result.ok) {
    for (const message of result.errors) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log(`Validated ${result.fileCount} curriculum JSON file(s).`);
}

if (process.argv[1]?.includes('validate-schema')) {
  main();
}
