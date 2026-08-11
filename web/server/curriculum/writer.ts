import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveValidatorKey,
  runFuriganaChecks,
} from '../../../scripts/validate-schema.js';
import { reload } from './loader.js';
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

/**
 * Replaces the item matching (type, level, slug) in its shipped file, in
 * place, then validates the whole file and atomically writes it back.
 * `updatedRaw` must be the full item object (client-side edited copy of the
 * `raw` field returned by GET /api/item/:type/:slug).
 */
export function saveItem(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
  updatedRaw: Record<string, unknown>,
): SaveResult {
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const filePath = filePathFor(curriculumDir, type, level);
  const relative = path.relative(curriculumDir, filePath).replace(/\\/g, '/');

  const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const arrayKey = DIR_BY_TYPE[type].arrayKey;
  const rows = file[arrayKey] as Record<string, unknown>[] | undefined;
  if (!Array.isArray(rows)) {
    return { ok: false, errors: [`${relative}: missing "${arrayKey}" array`] };
  }

  const index = rows.findIndex((row, i) => rowSlug(type, row, level, i) === slug);
  if (index === -1) {
    return { ok: false, errors: [`${relative}: no item with slug "${slug}"`] };
  }

  rows[index] = updatedRaw;

  const { errors } = validateFile(curriculumDir, relative, file);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);

  reload(repoRoot);
  return { ok: true };
}

/** One-click draft/reviewed/flagged_for_rewrite flip — same validate + atomic-write path as saveItem. */
export function updateReviewStatus(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
  reviewStatus: Exclude<ReviewStatus, 'none'>,
): SaveResult {
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const filePath = filePathFor(curriculumDir, type, level);
  const arrayKey = DIR_BY_TYPE[type].arrayKey;
  const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const rows = file[arrayKey] as Record<string, unknown>[] | undefined;
  if (!Array.isArray(rows)) {
    return { ok: false, errors: [`missing "${arrayKey}" array`] };
  }

  const index = rows.findIndex((row, i) => rowSlug(type, row, level, i) === slug);
  if (index === -1) {
    return { ok: false, errors: [`no item with slug "${slug}"`] };
  }

  const row = rows[index];
  const meta = (row._meta && typeof row._meta === 'object' ? row._meta : {}) as Record<string, unknown>;
  row._meta = { ...meta, review_status: reviewStatus };

  return saveItem(repoRoot, type, level, slug, row);
}
