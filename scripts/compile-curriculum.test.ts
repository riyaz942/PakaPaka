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
        .prepare('SELECT jp_cloze, jp_cloze_furigana, english, answer, nudge FROM grammar_cloze_variants')
        .get() as {
        jp_cloze: string;
        jp_cloze_furigana: string | null;
        english: string;
        answer: string;
        nudge: string;
      };
      expect(variant.jp_cloze).toBe('これは水＿＿＿。');
      expect(variant.jp_cloze_furigana).toBe('これは水[みず]＿＿＿。');
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
      // Kanji get no mnemonic art — the column stays null for them.
      expect(kanji.visual_mnemonic_url).toBeNull();

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
      expect(passage.english_translation).toBe('It is one.');
      expect(passage.summary_ja).toBe('一の話。');
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

      const exampleVocab = db
        .prepare(
          `SELECT sentence.japanese AS japanese, vocab.slug AS slug, link.sort_order
           FROM example_sentence_vocab link
           JOIN example_sentences sentence ON sentence.id = link.sentence_id
           JOIN items vocab ON vocab.id = link.item_id
           ORDER BY link.sort_order ASC`,
        )
        .all() as { japanese: string; slug: string; sort_order: number }[];
      expect(exampleVocab).toEqual([
        { japanese: '一があります。', slug: 'ichi-v', sort_order: 0 },
      ]);

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
        { slug: 'ichi-v', start_offset: 0, end_offset: 1, sort_order: 0 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('compiles Rev 1 fields (radical/vocab description, vocab split mnemonics, look-alike links)', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const dbPath = path.join(tempDir, 'curriculum.db');

    compileCurriculum(dbPath, FIXTURE_DIR);

    const db = new Database(dbPath, { readonly: true });
    try {
      const radical = db
        .prepare('SELECT description FROM items WHERE item_type = ? AND slug = ?')
        .get('radical', 'ichi') as { description: string | null };
      expect(radical.description).toContain('single stroke');

      const vocab = db
        .prepare(
          'SELECT meaning_mnemonic, reading_mnemonic, description FROM items WHERE item_type = ? AND slug = ?',
        )
        .get('vocabulary', 'ichi-v') as {
        meaning_mnemonic: string | null;
        reading_mnemonic: string | null;
        description: string | null;
      };
      expect(vocab.meaning_mnemonic).toContain('number one');
      expect(vocab.reading_mnemonic).toContain('いち');
      expect(vocab.description).toContain('counting word');

      const links = db
        .prepare(
          `SELECT source.slug AS from_slug, similar.slug AS to_slug
           FROM visually_similar_links link
           JOIN items source ON source.id = link.item_id
           JOIN items similar ON similar.id = link.similar_item_id
           ORDER BY source.slug ASC`,
        )
        .all() as { from_slug: string; to_slug: string }[];
      expect(links).toEqual([
        { from_slug: 'ichi', to_slug: 'n5-ichi' },
        { from_slug: 'n5-ichi', to_slug: 'ichi' },
      ]);

      const grammarMnemonic = db
        .prepare('SELECT mnemonic_text FROM items WHERE item_type = ? AND slug = ?')
        .get('grammar', 'desu') as { mnemonic_text: string | null };
      expect(grammarMnemonic.mnemonic_text).toBeNull();
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws on an unresolved visually similar slug', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const kanjiPath = path.join(curriculumDir, 'kanji', 'n5.json');
    const kanjiFile = JSON.parse(fs.readFileSync(kanjiPath, 'utf8'));
    kanjiFile.items[0].visually_similar_slugs = ['no-such-item'];
    fs.writeFileSync(kanjiPath, JSON.stringify(kanjiFile));

    try {
      expect(() => compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir)).toThrow(
        'Unresolved visually similar link: kanji:n5-ichi -> no-such-item',
      );
    } finally {
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
      /must be > 3|Invalid passage word span offsets/,
    );
  });

  it('throws on overlapping word spans', () => {
    expect(
      compileWithWordSpans([
        { vocabulary_slug: 'ichi-v', start: 0, end: 1 },
        { vocabulary_slug: 'ichi-v', start: 0, end: 1 },
      ]),
    ).toThrow(/Overlapping passage word span/);
  });

  it('throws when a word span surface does not match the vocabulary primary_form', () => {
    expect(compileWithWordSpans([{ vocabulary_slug: 'ichi-v', start: 1, end: 2 }])).toThrow(
      /Passage word span surface mismatch/,
    );
  });

  // --- taught-inflection spans (feedback 14.1a) ----------------------------

  it('accepts an inflected passage span whose surface is its own surface_form', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });
    const readingsPath = path.join(curriculumDir, 'readings', 'n5.json');
    const readingsFile = JSON.parse(fs.readFileSync(readingsPath, 'utf8'));
    readingsFile.passages[0].word_spans = [
      { vocabulary_slug: 'ichi-v', start: 0, end: 3, surface_form: '一です', inflection: 'masu' },
    ];
    fs.writeFileSync(readingsPath, JSON.stringify(readingsFile));

    const dbPath = path.join(tempDir, 'curriculum.db');
    compileCurriculum(dbPath, curriculumDir);
    const db = new Database(dbPath, { readonly: true });
    try {
      const span = db
        .prepare('SELECT start_offset, end_offset, inflection FROM passage_word_spans')
        .get() as { start_offset: number; end_offset: number; inflection: string | null };
      expect(span).toEqual({ start_offset: 0, end_offset: 3, inflection: 'masu' });
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // The JSON schema is the first gate on the inflection fields, so these two
  // never reach the compiler's own check (which still guards direct callers).
  it('rejects an inflection outside the taught families', () => {
    expect(
      compileWithWordSpans([
        { vocabulary_slug: 'ichi-v', start: 0, end: 3, surface_form: '一です', inflection: 'potential' },
      ]),
    ).toThrow(/inflection: must be equal to one of the allowed values/);
  });

  it('rejects a span that claims a surface_form without an inflection', () => {
    expect(
      compileWithWordSpans([{ vocabulary_slug: 'ichi-v', start: 0, end: 3, surface_form: '一です' }]),
    ).toThrow(/must have property inflection when property surface_form is present/);
  });

  function compileWithExampleSpans(wordSpans: unknown[]): {
    dbPath: string;
    tempDir: string;
    run: () => void;
  } {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const vocabPath = path.join(curriculumDir, 'vocabulary', 'n5.json');
    const vocabFile = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    vocabFile.items[0].example_sentences[0].word_spans = wordSpans;
    fs.writeFileSync(vocabPath, JSON.stringify(vocabFile));

    const dbPath = path.join(tempDir, 'curriculum.db');
    return { dbPath, tempDir, run: () => compileCurriculum(dbPath, curriculumDir) };
  }

  it('compiles example sentence spans, dictionary and inflected', () => {
    // "一があります。" — 一 in its dictionary form, and (as a stand-in for a
    // conjugated verb) an inflected span the fixture vocabulary can carry.
    const { dbPath, tempDir, run } = compileWithExampleSpans([
      { vocabulary_slug: 'ichi-v', start: 0, end: 1 },
      { vocabulary_slug: 'ichi-v', start: 2, end: 6, surface_form: 'あります', inflection: 'masu' },
    ]);
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const spans = db
        .prepare(
          `SELECT vocab.slug AS slug, span.start_offset, span.end_offset, span.inflection, span.sort_order
           FROM example_sentence_spans span
           JOIN items vocab ON vocab.id = span.item_id
           JOIN example_sentences sentence ON sentence.id = span.sentence_id
           ORDER BY span.sort_order ASC`,
        )
        .all();
      expect(spans).toEqual([
        { slug: 'ichi-v', start_offset: 0, end_offset: 1, inflection: null, sort_order: 0 },
        { slug: 'ichi-v', start_offset: 2, end_offset: 6, inflection: 'masu', sort_order: 1 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws when an example sentence span does not slice its own surface', () => {
    const { tempDir, run } = compileWithExampleSpans([
      { vocabulary_slug: 'ichi-v', start: 2, end: 4, surface_form: 'あります', inflection: 'masu' },
    ]);
    expect(run).toThrow(/Example sentence span surface mismatch/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
