import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveValidatorKey,
  runFuriganaChecks,
} from '../../../scripts/validate-schema.js';
import { reload } from './loader.js';
import {
  checkReviewStatusTarget,
  mergeGrammarReviewStatus,
  persistGrammarMnemonicReviewStatus,
  persistItemEdit,
  persistReviewStatus,
  readGrammarLessonStatus,
  readGrammarMnemonicStatus,
} from './sidecar.js';
import type { ContentType, JlptLevel, ReviewStatus } from './types.js';

const DIR_BY_TYPE: Record<ContentType, { dir: string; arrayKey: 'items' | 'passages' }> = {
  radical: { dir: 'radicals', arrayKey: 'items' },
  kanji: { dir: 'kanji', arrayKey: 'items' },
  vocabulary: { dir: 'vocabulary', arrayKey: 'items' },
  grammar: { dir: 'grammar', arrayKey: 'items' },
  reading: { dir: 'readings', arrayKey: 'passages' },
};

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

function filePathFor(curriculumDir: string, type: ContentType, level: JlptLevel): string {
  const { dir } = DIR_BY_TYPE[type];
  return path.join(curriculumDir, dir, `${level.toLowerCase()}.json`);
}

/** Mirrors loader.ts's passageSlug: reading passages may have no `slug` field. */
function rowSlug(type: ContentType, row: Record<string, unknown>, level: JlptLevel, index: number): string {
  if (typeof row.slug === 'string' && row.slug.length > 0) {
    return row.slug;
  }
  if (type !== 'reading') {
    return '';
  }
  const sortOrder = typeof row.sort_order === 'number' ? row.sort_order : index;
  return `passage-${level.toLowerCase()}-${sortOrder}`;
}

function validateFile(
  curriculumDir: string,
  relative: string,
  data: unknown,
): { errors: string[]; warnings: string[] } {
  const schemaPath = path.join(curriculumDir, 'schema', 'curriculum.schema.json');
  const schemaRaw = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
  const ajv = new Ajv({ allErrors: true, strict: false, $data: true });
  addFormats(ajv);

  const schemaId = (schemaRaw.$id as string) ?? 'curriculum.schema.json';
  ajv.addSchema(schemaRaw, schemaId);

  const validatorKey = resolveValidatorKey(relative);
  const validate: ValidateFunction = ajv.compile({ $ref: `${schemaId}#/$defs/${validatorKey}` });

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!validate(data)) {
    const messages = (validate.errors ?? [])
      .map((err) => `${err.instancePath || '/'}: ${err.message}`)
      .join('; ');
    errors.push(`${relative}: ${messages}`);
    return { errors, warnings };
  }

  runFuriganaChecks(validatorKey, relative, data, errors, warnings);
  return { errors, warnings };
}

type OpenedFile = {
  filePath: string;
  relative: string;
  file: Record<string, unknown>;
  rows: Record<string, unknown>[];
};

function openLevelFile(
  curriculumDir: string,
  type: ContentType,
  level: JlptLevel,
): OpenedFile | { errors: string[] } {
  const filePath = filePathFor(curriculumDir, type, level);
  const relative = path.relative(curriculumDir, filePath).replace(/\\/g, '/');
  const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const arrayKey = DIR_BY_TYPE[type].arrayKey;
  const rows = file[arrayKey] as Record<string, unknown>[] | undefined;
  if (!Array.isArray(rows)) {
    return { errors: [`${relative}: missing "${arrayKey}" array`] };
  }
  return { filePath, relative, file, rows };
}

function writeLevelFile(filePath: string, file: Record<string, unknown>): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Replaces the item matching (type, level, slug) in its shipped file, in
 * place, then validates the whole file and atomically writes it back.
 * `updatedRaw` must be the full item object (client-side edited copy of the
 * `raw` field returned by GET /api/item/:type/:slug).
 *
 * The shipped file is generated output. Every change is written to the sidecar
 * generate.py rebuilds it from as well (sidecar.ts), and a change to a field
 * with no such sidecar is refused rather than written to a file the next
 * generate run overwrites.
 */
export function saveItem(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
  updatedRaw: Record<string, unknown>,
): SaveResult {
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const opened = openLevelFile(curriculumDir, type, level);
  if ('errors' in opened) {
    return { ok: false, errors: opened.errors };
  }
  const { filePath, relative, file, rows } = opened;

  const index = rows.findIndex((row, i) => rowSlug(type, row, level, i) === slug);
  if (index === -1) {
    return { ok: false, errors: [`${relative}: no item with slug "${slug}"`] };
  }

  const currentRaw = rows[index];
  rows[index] = updatedRaw;

  const { errors } = validateFile(curriculumDir, relative, file);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const persisted = persistItemEdit(repoRoot, type, slug, currentRaw, updatedRaw);
  if (!persisted.ok) {
    return persisted;
  }

  writeLevelFile(filePath, file);
  reload(repoRoot);
  return { ok: true };
}

/** Sets `_meta.review_status` on a row; 'none' removes it (and `_meta` if that leaves it empty). */
function applyReviewStatus(
  row: Record<string, unknown>,
  meta: Record<string, unknown>,
  reviewStatus: ReviewStatus,
): void {
  const { review_status: _dropped, ...rest } = meta;
  const next = reviewStatus === 'none' ? rest : { ...rest, review_status: reviewStatus };
  if (Object.keys(next).length > 0) {
    row._meta = next;
  } else {
    delete row._meta;
  }
}

/**
 * One-click draft/reviewed/flagged_for_rewrite/none flip. The status lives in the
 * sidecar `_meta` (or, for grammar, the lesson frontmatter); the shipped file
 * is updated to match so the UI reflects it without a generate run.
 */
export function updateReviewStatus(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
  reviewStatus: ReviewStatus,
): SaveResult {
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const opened = openLevelFile(curriculumDir, type, level);
  if ('errors' in opened) {
    return { ok: false, errors: opened.errors };
  }
  const { filePath, relative, file, rows } = opened;

  const index = rows.findIndex((row, i) => rowSlug(type, row, level, i) === slug);
  if (index === -1) {
    return { ok: false, errors: [`${relative}: no item with slug "${slug}"`] };
  }

  const row = rows[index];
  const meta = (row._meta && typeof row._meta === 'object' ? row._meta : {}) as Record<string, unknown>;
  // A grammar row carries the least reviewed of lesson and mnemonic, which is
  // what generate.py writes; anything else fails CI's regeneration check.
  const rowStatus =
    type === 'grammar'
      ? mergeGrammarReviewStatus(reviewStatus, readGrammarMnemonicStatus(repoRoot, slug))
      : reviewStatus;
  applyReviewStatus(row, meta, rowStatus);

  const { errors } = validateFile(curriculumDir, relative, file);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const persisted = persistReviewStatus(repoRoot, type, slug, reviewStatus);
  if (!persisted.ok) {
    return persisted;
  }

  writeLevelFile(filePath, file);
  reload(repoRoot);
  return { ok: true };
}

/**
 * A grammar mnemonic's own review status. The sidecar takes the status; the
 * shipped row takes the merge with the lesson's, as generate.py would write it.
 */
export function updateGrammarMnemonicReviewStatus(
  repoRoot: string,
  level: JlptLevel,
  slug: string,
  reviewStatus: ReviewStatus,
): SaveResult {
  const blocked = checkReviewStatusTarget(repoRoot, 'grammar', slug);
  if (blocked.length > 0) {
    return { ok: false, errors: blocked };
  }
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const opened = openLevelFile(curriculumDir, 'grammar', level);
  if ('errors' in opened) {
    return { ok: false, errors: opened.errors };
  }
  const { filePath, relative, file, rows } = opened;
  const index = rows.findIndex((row, i) => rowSlug('grammar', row, level, i) === slug);
  if (index === -1) {
    return { ok: false, errors: [`${relative}: no item with slug "${slug}"`] };
  }

  const row = rows[index];
  const meta = (row._meta && typeof row._meta === 'object' ? row._meta : {}) as Record<string, unknown>;
  applyReviewStatus(row, meta, mergeGrammarReviewStatus(readGrammarLessonStatus(repoRoot, slug), reviewStatus));

  const { errors } = validateFile(curriculumDir, relative, file);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const persisted = persistGrammarMnemonicReviewStatus(repoRoot, slug, reviewStatus);
  if (!persisted.ok) {
    return persisted;
  }
  writeLevelFile(filePath, file);
  reload(repoRoot);
  return { ok: true };
}

export type BulkUpdateItem = { type: ContentType; level: JlptLevel; slug: string };
export type BulkUpdateResult =
  | { ok: true; updated: number }
  | { ok: false; errors: string[] };

/**
 * Bulk status flip for the Content list's multi-select bar. Groups the
 * selection by source file (one file per type+level), validates every
 * resulting file up front — and checks every item has a sidecar to persist the
 * status to — and only writes once all of them pass, so a bad item in one file
 * can't leave other files partially updated.
 */
export function updateReviewStatusBulk(
  repoRoot: string,
  items: BulkUpdateItem[],
  reviewStatus: ReviewStatus,
): BulkUpdateResult {
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const errors: string[] = [];

  for (const item of items) {
    errors.push(...checkReviewStatusTarget(repoRoot, item.type, item.slug));
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const groups = new Map<string, { type: ContentType; level: JlptLevel; slugs: string[] }>();
  for (const item of items) {
    const key = `${item.type}:${item.level}`;
    const group = groups.get(key);
    if (group) {
      group.slugs.push(item.slug);
    } else {
      groups.set(key, { type: item.type, level: item.level, slugs: [item.slug] });
    }
  }

  const pending: Array<{ filePath: string; relative: string; file: Record<string, unknown> }> = [];
  let updated = 0;

  for (const { type, level, slugs } of groups.values()) {
    const filePath = filePathFor(curriculumDir, type, level);
    const relative = path.relative(curriculumDir, filePath).replace(/\\/g, '/');
    const arrayKey = DIR_BY_TYPE[type].arrayKey;
    const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const rows = file[arrayKey] as Record<string, unknown>[] | undefined;
    if (!Array.isArray(rows)) {
      errors.push(`${relative}: missing "${arrayKey}" array`);
      continue;
    }

    for (const slug of slugs) {
      const index = rows.findIndex((row, i) => rowSlug(type, row, level, i) === slug);
      if (index === -1) {
        errors.push(`${relative}: no item with slug "${slug}"`);
        continue;
      }
      const row = rows[index];
      const meta = (row._meta && typeof row._meta === 'object' ? row._meta : {}) as Record<string, unknown>;
      const rowStatus =
        type === 'grammar'
          ? mergeGrammarReviewStatus(reviewStatus, readGrammarMnemonicStatus(repoRoot, slug))
          : reviewStatus;
      applyReviewStatus(row, meta, rowStatus);
      updated += 1;
    }

    const { errors: fileErrors } = validateFile(curriculumDir, relative, file);
    if (fileErrors.length > 0) {
      errors.push(...fileErrors);
      continue;
    }
    pending.push({ filePath, relative, file });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  for (const item of items) {
    const persisted = persistReviewStatus(
      repoRoot, item.type, item.slug, reviewStatus,
    );
    if (!persisted.ok) {
      return { ok: false, errors: persisted.errors };
    }
  }

  for (const { filePath, file } of pending) {
    writeLevelFile(filePath, file);
  }

  reload(repoRoot);
  return { ok: true, updated };
}
