import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { assignItemIds, compileCurriculum } from './compile-curriculum';

const FIXTURE_DIR = path.join(__dirname, '__fixtures__', 'valid');

describe('compile-curriculum', () => {
  it('assigns deterministic item ids by type then level then slug', () => {
    const ids = assignItemIds(
      [{ slug: 'b', primary_form: 'B', meaning: 'b', visual_mnemonic_url: 'https://a.example/b.png', jlpt_level: 'N5' }],
      [{ slug: 'a', primary_form: 'A', meaning: 'a', jlpt_level: 'N4' }],
      [],
      [],
    );
    expect(ids.get('radical:b')).toBe(1);
    expect(ids.get('kanji:a')).toBe(2);
  });

  it('preserves N5 ids before N4 within the same type', () => {
    const ids = assignItemIds(
      [
        { slug: 'n4-z', primary_form: 'Z', meaning: 'z', visual_mnemonic_url: 'https://a.example/z.png', jlpt_level: 'N4' },
        { slug: 'n5-a', primary_form: 'A', meaning: 'a', visual_mnemonic_url: 'https://a.example/a.png', jlpt_level: 'N5' },
      ],
      [],
      [],
      [],
    );
    expect(ids.get('radical:n5-a')).toBe(1);
    expect(ids.get('radical:n4-z')).toBe(2);
  });

  it('compiles fixture JSON to sqlite with metadata and relationships', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const dbPath = path.join(tempDir, 'curriculum.db');

    compileCurriculum(dbPath, FIXTURE_DIR);

    const db = new Database(dbPath, { readonly: true });
    try {
      const metadata = db
        .prepare('SELECT version, content_hash, item_count FROM curriculum_metadata')
        .get() as { version: string; content_hash: string; item_count: number };

      expect(metadata.version).toBe('0.0.1-test');
      expect(metadata.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.item_count).toBe(5);

      const itemCount = db.prepare('SELECT COUNT(*) AS count FROM items').get() as { count: number };
      const relationshipCount = db
        .prepare('SELECT COUNT(*) AS count FROM item_relationships')
        .get() as { count: number };

      expect(itemCount.count).toBe(5);
      expect(relationshipCount.count).toBe(2);

      // Plan 09: family lands on grammar_rules, variants in their own table.
      const rule = db
        .prepare('SELECT family FROM grammar_rules WHERE structure = ?')
        .get('Noun + です') as { family: string | null };
      expect(rule.family).toBe('copula');

      const variant = db
        .prepare('SELECT jp_cloze, english, answer, nudge FROM grammar_cloze_variants')
        .get() as { jp_cloze: string; english: string; answer: string; nudge: string };
      expect(variant.jp_cloze).toBe('これは水＿＿＿。');
      expect(variant.answer).toBe('です');
      expect(variant.nudge).toContain('copula');
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('compiles Phase 0 content-pipeline fields (split mnemonics, lesson body, passage metadata)', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const dbPath = path.join(tempDir, 'curriculum.db');

    compileCurriculum(dbPath, FIXTURE_DIR);

    const db = new Database(dbPath, { readonly: true });
    try {
      const kanji = db
        .prepare(
          'SELECT meaning_mnemonic, reading_mnemonic, description, visual_mnemonic_url FROM items WHERE item_type = ? AND slug = ?',
        )
        .get('kanji', 'n5-ichi') as {
        meaning_mnemonic: string | null;
        reading_mnemonic: string | null;
        description: string | null;
        visual_mnemonic_url: string | null;
      };
      expect(kanji.meaning_mnemonic).toContain('single horizontal stroke');
      expect(kanji.reading_mnemonic).toContain('いち');
      expect(kanji.description).toContain('simplest kanji');
      expect(kanji.visual_mnemonic_url).toBe('https://assets.example/kanji/n5/n5-ichi.png');

      const rule = db
        .prepare('SELECT explanation_markdown, caution_notes FROM grammar_rules WHERE structure = ?')
        .get('Noun + です') as { explanation_markdown: string | null; caution_notes: string | null };
      expect(rule.explanation_markdown).toContain('polite copula');
      expect(JSON.parse(rule.caution_notes!)).toEqual([
        'です attaches to nouns and な-adjectives, never directly to verbs.',
      ]);

      const relatedLink = db
        .prepare(
          `SELECT parent.slug AS from_slug, related.slug AS to_slug
           FROM grammar_related_links link
           JOIN items parent ON parent.id = link.grammar_item_id
           JOIN items related ON related.id = link.related_item_id`,
        )
        .get() as { from_slug: string; to_slug: string };
      expect(relatedLink).toEqual({ from_slug: 'desu', to_slug: 'ja-nai' });

      const passage = db
        .prepare(
          'SELECT id, english_translation, summary_ja, summary_en, word_count FROM reading_passages',
        )
        .get() as {
        id: number;
        english_translation: string | null;
        summary_ja: string | null;
        summary_en: string | null;
        word_count: number | null;
      };
      expect(passage.english_translation).toBe('It is a test.');
      expect(passage.summary_ja).toBe('テストの話。');
      expect(passage.summary_en).toBe('A short test passage.');
      expect(passage.word_count).toBe(2);

      const passageGrammar = db
        .prepare(
          `SELECT items.slug AS slug FROM passage_grammar_links link
           JOIN items ON items.id = link.grammar_item_id
           WHERE link.passage_id = ?`,
        )
        .all(passage.id) as { slug: string }[];
      expect(passageGrammar).toEqual([{ slug: 'desu' }]);

      const passageVocab = db
        .prepare(
          `SELECT items.slug AS slug FROM passage_vocabulary_links link
           JOIN items ON items.id = link.vocabulary_item_id
           WHERE link.passage_id = ?`,
        )
        .all(passage.id) as { slug: string }[];
      expect(passageVocab).toEqual([{ slug: 'ichi-v' }]);

      const wordSpans = db
        .prepare(
          `SELECT items.slug AS slug, span.start_offset, span.end_offset, span.sort_order
           FROM passage_word_spans span
           JOIN items ON items.id = span.vocabulary_item_id
           WHERE span.passage_id = ?
           ORDER BY span.sort_order ASC`,
        )
        .all(passage.id) as {
        slug: string;
        start_offset: number;
        end_offset: number;
        sort_order: number;
      }[];
      expect(wordSpans).toEqual([
        { slug: 'ichi-v', start_offset: 0, end_offset: 3, sort_order: 0 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws on an unresolved related grammar slug', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
    const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    grammarFile.items[0].related_grammar_slugs = ['no-such-grammar'];
    fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));

    try {
      expect(() => compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir)).toThrow(
        'Unresolved related grammar link: desu -> grammar:no-such-grammar',
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('warns on draft content but still compiles by default', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
    const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    grammarFile.items[0]._meta = {
      generator_model: 'claude-fable-5',
      prompt_version: 'grammar-lesson-v1',
      review_status: 'draft',
    };
    fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir);

      expect(fs.existsSync(path.join(tempDir, 'curriculum.db'))).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unreviewed content: grammar:desu (draft)'),
      );
    } finally {
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails on draft content when failOnDraft is set', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
    const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    grammarFile.items[0]._meta = { review_status: 'draft' };
    fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));

    try {
      expect(() =>
        compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir, {
          failOnDraft: true,
        }),
      ).toThrow('Unreviewed content cannot ship (1 item(s)):\ngrammar:desu (draft)');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('accepts reviewed content without warning', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
    const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    grammarFile.items[0]._meta = { review_status: 'reviewed', reviewed_by: 'riyaz' };
    fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir, {
        failOnDraft: true,
      });

      expect(fs.existsSync(path.join(tempDir, 'curriculum.db'))).toBe(true);
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('unreviewed content'));
    } finally {
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws on an unresolved passage grammar slug', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const readingsPath = path.join(curriculumDir, 'readings', 'n5.json');
    const readingsFile = JSON.parse(fs.readFileSync(readingsPath, 'utf8'));
    readingsFile.passages[0].grammar_slugs = ['no-such-grammar'];
    fs.writeFileSync(readingsPath, JSON.stringify(readingsFile));

    try {
      expect(() => compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir)).toThrow(
        'Unresolved passage grammar link: Test -> grammar:no-such-grammar',
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function compileWithWordSpans(wordSpans: unknown[]): () => void {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const readingsPath = path.join(curriculumDir, 'readings', 'n5.json');
    const readingsFile = JSON.parse(fs.readFileSync(readingsPath, 'utf8'));
    readingsFile.passages[0].word_spans = wordSpans;
    fs.writeFileSync(readingsPath, JSON.stringify(readingsFile));

    return () => compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir);
  }

  it('throws on a word span with an unresolved vocabulary slug', () => {
    expect(
      compileWithWordSpans([{ vocabulary_slug: 'no-such-vocab', start: 0, end: 3 }]),
    ).toThrow('Unresolved passage word span: Test -> vocabulary:no-such-vocab');
  });

  it('throws on a word span whose end offset runs past the body', () => {
    expect(compileWithWordSpans([{ vocabulary_slug: 'ichi-v', start: 0, end: 99 }])).toThrow(
      /Invalid passage word span offsets/,
    );
  });

  it('throws on a word span with a non-increasing range', () => {
    expect(compileWithWordSpans([{ vocabulary_slug: 'ichi-v', start: 3, end: 3 }])).toThrow(
      /Invalid passage word span offsets/,
    );
  });

  it('throws on overlapping word spans', () => {
    expect(
      compileWithWordSpans([
        { vocabulary_slug: 'ichi-v', start: 0, end: 3 },
        { vocabulary_slug: 'ichi-v', start: 2, end: 5 },
      ]),
    ).toThrow(/Overlapping passage word span/);
  });
});
