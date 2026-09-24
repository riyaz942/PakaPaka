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
      version: 1,
      jlpt_levels: ['N5'],
      description: 'Fixture metadata for furigana validation tests',
    }),
  );
  fs.mkdirSync(path.join(tempDir, 'vocabulary'));
  fs.writeFileSync(
    path.join(tempDir, 'vocabulary', 'n5.json'),
    JSON.stringify({
      jlpt_level: 'N5',
      // Every vocabulary item needs a reading answer key; supply a default so
      // tests about other fields do not have to restate it.
      items: [{ accepted_answers: [{ answer_type: 'reading', answer_text: 'かな' }], ...vocabularyItem }],
    }),
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

describe('validateCurriculum vocabulary reading answer key', () => {
  it('errors when a vocabulary item has no accepted_answers at all', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'taberu',
      primary_form: '食べる',
      furigana: '食[た]べる',
      meaning: 'to eat',
      accepted_answers: [],
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
      expect(
        result.ok ? [] : result.errors.filter((e) => e.includes('accepted_answers needs a reading')),
      ).toHaveLength(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('errors when the only accepted answers are meanings', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'taberu',
      primary_form: '食べる',
      furigana: '食[た]べる',
      meaning: 'to eat',
      accepted_answers: [{ answer_type: 'meaning', answer_text: 'to eat', is_primary: true }],
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts a production answer in place of a reading', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'taberu',
      primary_form: '食べる',
      furigana: '食[た]べる',
      meaning: 'to eat',
      accepted_answers: [{ answer_type: 'production', answer_text: 'たべる' }],
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function writeTempGrammarDir(grammarItem: Record<string, unknown>): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-cloze-'));
  fs.writeFileSync(
    path.join(tempDir, 'metadata.json'),
    JSON.stringify({
      version: 1,
      jlpt_levels: ['N5'],
      description: 'Fixture metadata for cloze validation tests',
    }),
  );
  fs.mkdirSync(path.join(tempDir, 'grammar'));
  fs.writeFileSync(
    path.join(tempDir, 'grammar', 'n5.json'),
    JSON.stringify({ jlpt_level: 'N5', items: [grammarItem] }),
  );
  return tempDir;
}

describe('validateCurriculum cloze variant checks (Plan 09)', () => {
  const baseItem = {
    slug: 'wa-topic',
    primary_form: 'は',
    meaning: 'topic marker',
    structure: 'Noun + は + comment',
    conjugation_rules: {},
    accepted_forms: ['は'],
    family: 'particles',
  };

  it('accepts a consistent variant', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      cloze_variants: [
        { jp_cloze: '私＿＿＿学生です。', english: 'I am a student.', answer: 'は', nudge: 'Topic.' },
      ],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('errors when the variant answer is not an accepted form', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      cloze_variants: [
        { jp_cloze: '私＿＿＿学生です。', english: 'I am a student.', answer: 'が', nudge: 'Topic.' },
      ],
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('not in accepted_forms'))).toBe(true);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a jp_cloze without a blank via the schema', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      cloze_variants: [
        { jp_cloze: '私は学生です。', english: 'I am a student.', answer: 'は', nudge: 'Topic.' },
      ],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects an unknown family via the schema enum', () => {
    const tempDir = writeTempGrammarDir({ ...baseItem, family: 'other' });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('validateCurriculum Phase 0 content-pipeline fields', () => {
  const baseItem = {
    slug: 'wa-topic',
    primary_form: 'は',
    meaning: 'topic marker',
    structure: 'Noun + は + comment',
    conjugation_rules: {},
    accepted_forms: ['は'],
  };

  it('accepts explanation_markdown, caution_notes, and related_grammar_slugs', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      explanation_markdown: '# は\n\nThe topic marker sets the stage for the sentence.',
      caution_notes: ['は is pronounced わ when used as a particle.'],
      related_grammar_slugs: ['ga-subject'],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('errors when related_grammar_slugs references the item itself', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      related_grammar_slugs: ['wa-topic'],
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.includes('must not reference the item itself'))).toBe(
          true,
        );
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects an empty caution_notes array via the schema', () => {
    const tempDir = writeTempGrammarDir({ ...baseItem, caution_notes: [] });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts a _meta sidecar with review metadata', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      _meta: {
        generator_model: 'claude-fable-5',
        prompt_version: 'grammar-lesson-v1',
        review_status: 'draft',
      },
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a _meta sidecar with an unknown review_status', () => {
    const tempDir = writeTempGrammarDir({
      ...baseItem,
      _meta: { review_status: 'approved' },
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function writeTempReadingsDir(passage: Record<string, unknown>): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-readings-'));
    fs.writeFileSync(
      path.join(tempDir, 'metadata.json'),
      JSON.stringify({
        version: 1,
        jlpt_levels: ['N5'],
        description: 'Fixture metadata for readings validation tests',
      }),
    );
    fs.mkdirSync(path.join(tempDir, 'readings'));
    fs.writeFileSync(
      path.join(tempDir, 'readings', 'n5.json'),
      JSON.stringify({ jlpt_level: 'N5', passages: [passage] }),
    );
    return tempDir;
  }

  it('accepts passage english_translation, slug lists, and word_count', () => {
    const tempDir = writeTempReadingsDir({
      title: 'Test',
      body: 'テストです。',
      english_translation: 'It is a test.',
      grammar_slugs: ['desu'],
      vocabulary_slugs: ['ichi-v'],
      word_count: 2,
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts passage summaries and authored word spans', () => {
    const tempDir = writeTempReadingsDir({
      title: 'Test',
      body: '一です。',
      summary_ja: '一の話。',
      summary_en: 'A short test passage.',
      word_spans: [{ vocabulary_slug: 'ichi-v', start: 0, end: 1 }],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a word span whose end is not greater than start', () => {
    const tempDir = writeTempReadingsDir({
      title: 'Test',
      body: '一です。',
      word_spans: [{ vocabulary_slug: 'ichi-v', start: 2, end: 1 }],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a word span missing its offsets', () => {
    const tempDir = writeTempReadingsDir({
      title: 'Test',
      body: '一です。',
      word_spans: [{ vocabulary_slug: 'ichi-v', start: 0 }],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a zero word_count via the schema', () => {
    const tempDir = writeTempReadingsDir({
      title: 'Test',
      body: 'テストです。',
      word_count: 0,
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function writeTempKanjiDir(kanjiItem: Record<string, unknown>): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-kanji-'));
    fs.writeFileSync(
      path.join(tempDir, 'metadata.json'),
      JSON.stringify({
        version: 1,
        jlpt_levels: ['N5'],
        description: 'Fixture metadata for kanji validation tests',
      }),
    );
    fs.mkdirSync(path.join(tempDir, 'kanji'));
    fs.writeFileSync(
      path.join(tempDir, 'kanji', 'n5.json'),
      JSON.stringify({ jlpt_level: 'N5', items: [kanjiItem] }),
    );
    return tempDir;
  }

  it('accepts split kanji mnemonics and description', () => {
    const tempDir = writeTempKanjiDir({
      slug: 'n5-ichi',
      primary_form: '一',
      meaning: 'one',
      meaning_mnemonic: 'A single stroke: one.',
      reading_mnemonic: 'You itch (いち) after one mosquito bite.',
      description: 'The simplest kanji.',
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects visual_mnemonic_url on kanji — mnemonic art stops at the radical layer', () => {
    const tempDir = writeTempKanjiDir({
      slug: 'n5-ichi',
      primary_form: '一',
      meaning: 'one',
      visual_mnemonic_url: 'radicals/n5/ichi.webp',
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('validateCurriculum Rev 1 fields', () => {
  function writeTempRadicalDir(radicalItem: Record<string, unknown>): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-radical-'));
    fs.writeFileSync(
      path.join(tempDir, 'metadata.json'),
      JSON.stringify({
        version: 1,
        jlpt_levels: ['N5'],
        description: 'Fixture metadata for radical validation tests',
      }),
    );
    fs.mkdirSync(path.join(tempDir, 'radicals'));
    fs.writeFileSync(
      path.join(tempDir, 'radicals', 'n5.json'),
      JSON.stringify({ jlpt_level: 'N5', items: [radicalItem] }),
    );
    return tempDir;
  }

  const baseRadical = {
    slug: 'ichi',
    primary_form: '一',
    meaning: 'one',
    visual_mnemonic_url: 'radicals/n5/ichi.webp',
  };

  it('accepts a radical description and visually_similar_slugs', () => {
    const tempDir = writeTempRadicalDir({
      ...baseRadical,
      description: 'A single stroke lying flat: the ground.',
      visually_similar_slugs: ['n5-ichi'],
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a remote radical visual_mnemonic_url — art is bundled, not hosted', () => {
    const tempDir = writeTempRadicalDir({
      ...baseRadical,
      visual_mnemonic_url: 'https://assets.example/radicals/n5/ichi.webp',
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects a radical visual_mnemonic_url that is not WebP', () => {
    const tempDir = writeTempRadicalDir({
      ...baseRadical,
      visual_mnemonic_url: 'radicals/n5/ichi.png',
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('errors when radical visually_similar_slugs references the item itself', () => {
    const tempDir = writeTempRadicalDir({
      ...baseRadical,
      visually_similar_slugs: ['ichi'],
    });
    try {
      const result = validateCurriculum(tempDir);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some((e) =>
            e.includes('visually_similar_slugs must not reference the item itself'),
          ),
        ).toBe(true);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects grammar mnemonic_text via the schema', () => {
    const tempDir = writeTempGrammarDir({
      slug: 'wa-topic',
      primary_form: 'は',
      meaning: 'topic marker',
      structure: 'Noun + は + comment',
      conjugation_rules: {},
      accepted_forms: ['は'],
      mnemonic_text: 'は marks the topic.',
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts vocabulary split mnemonics and description', () => {
    const tempDir = writeTempCurriculumDir({
      slug: 'ichi-v',
      primary_form: '一',
      meaning: 'one',
      meaning_mnemonic: 'The kanji 一 standing alone is the number one.',
      reading_mnemonic: 'You already know いち from 一.',
      description: 'The plain counting word for one.',
    });
    try {
      expect(validateCurriculum(tempDir).ok).toBe(true);
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
