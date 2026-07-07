import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { stripFurigana, validateCurriculum } from './validate-schema';

const SCHEMA_PATH = path.join(__dirname, '..', 'curriculum', 'schema', 'curriculum.schema.json');

function compileRadicalsValidator() {
  const schemaRaw = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as {
    $id?: string;
    $defs: Record<string, unknown>;
  };
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schemaId = schemaRaw.$id ?? 'curriculum.schema.json';
  ajv.addSchema(schemaRaw, schemaId);
  return ajv.compile({ $ref: `${schemaId}#/$defs/radicalsFile` });
}

function writeTempCurriculumDir(vocabularyItem: Record<string, unknown>): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-furigana-'));
  fs.writeFileSync(
    path.join(tempDir, 'metadata.json'),
    JSON.stringify({
      version: '0.0.1-test',
      jlpt_levels: ['N5'],
      description: 'Fixture metadata for furigana validation tests',
    }),
  );
  fs.mkdirSync(path.join(tempDir, 'vocabulary'));
  fs.writeFileSync(
    path.join(tempDir, 'vocabulary', 'n5.json'),
    JSON.stringify({ jlpt_level: 'N5', items: [vocabularyItem] }),
  );
  return tempDir;
}

describe('stripFurigana', () => {
  it('round-trips a multi-bracket sentence to its plain form', () => {
    expect(stripFurigana('私[わたし]は学生[がくせい]です。')).toBe('私は学生です。');
  });

  it('leaves plain text with no brackets untouched', () => {
    expect(stripFurigana('こんにちは')).toBe('こんにちは');
  });
});

describe('validateCurriculum furigana checks', () => {
  it('accepts a fully-covered, kana-only, round-tripping annotation with no errors or warnings', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'taberu',
      primary_form: '食べる',
      furigana: '食[た]べる',
      meaning: 'to eat',
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(true);
      expect(result.warnings).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('errors when the furigana does not strip back to the plain primary_form', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'taberu',
      primary_form: '食べる',
      furigana: '食[た]べます',
      meaning: 'to eat',
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('strips to'))).toBe(true);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('errors when a bracket reading is not kana-only', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'taberu',
      primary_form: '食べる',
      furigana: '食[food]べる',
      meaning: 'to eat',
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('not kana-only'))).toBe(true);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('warns (but does not fail) when a kanji character is not covered by any annotation', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'gakusei',
      primary_form: '学生',
      furigana: '学[がく]生',
      meaning: 'student',
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(true);
      expect(result.warnings.some((w) => w.includes('not every kanji character'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('curriculum schema validation', () => {
  it('accepts valid radicals fixture', () => {
    const validate = compileRadicalsValidator();
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '__fixtures__', 'valid', 'radicals', 'n5.json'),
        'utf8',
      ),
    );
    expect(validate(fixture)).toBe(true);
  });

  it('rejects invalid radical URL', () => {
    const validate = compileRadicalsValidator();
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, '__fixtures__', 'invalid-radical.json'), 'utf8'),
    );
    expect(validate(fixture)).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
