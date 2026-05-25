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
  | { ok: true; fileCount: number }
  | { ok: false; errors: string[] };

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
    return { ok: false, errors: [`${schemaPath}: missing $defs`] };
  }

  const validators = new Map<string, ValidateFunction>();
  for (const key of Object.keys(defs)) {
    const validate = ajv.compile({ $ref: `${schemaId}#/$defs/${key}` });
    validators.set(key, validate);
  }

  const files = discoverJsonFilesIn(curriculumDir);
  const errors: string[] = [];

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
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, fileCount: files.length };
}

function discoverJsonFilesIn(curriculumDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
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
