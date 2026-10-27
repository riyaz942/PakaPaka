import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { assignItemIds, compileAndRecordMetadata, compileCurriculum } from './compile-curriculum';
import { type IdRegistry, type IdRegistrySection, resolveRegistryIds } from './id-registry';

const FIXTURE_DIR = path.join(__dirname, '__fixtures__', 'valid');

function section(
  ids: Record<string, number>,
  extra: Partial<IdRegistrySection> = {},
): IdRegistrySection {
  return { next_id: 100, ids, retired: {}, aliases: {}, ...extra };
}

function copyFixture(): { tempDir: string; curriculumDir: string; dbPath: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
  const curriculumDir = path.join(tempDir, 'curriculum');
  fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });
  return { tempDir, curriculumDir, dbPath: path.join(tempDir, 'curriculum.db') };
}

function readItemIds(dbPath: string): Record<string, number> {
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare('SELECT item_type, slug, id FROM items').all() as {
      item_type: string;
      slug: string;
      id: number;
    }[];
    return Object.fromEntries(rows.map((row) => [`${row.item_type}:${row.slug}`, row.id]));
  } finally {
    db.close();
  }
}

const radical = (slug: string, jlpt_level: string) => ({
  slug,
  primary_form: slug,
  meaning: slug,
  jlpt_level,
});

describe('item id registry', () => {
  it('keeps recorded ids whatever the level and sort order', () => {
    const { idByKey } = assignItemIds(
      [radical('a', 'N4'), radical('b', 'N5')],
      [],
      [],
      [],
      section({ 'radical:a': 7, 'radical:b': 3 }),
    );
    expect(idByKey.get('radical:a')).toBe(7);
    expect(idByKey.get('radical:b')).toBe(3);
  });

  it('fails on a key with no id unless updateRegistry is set', () => {
    const registry = section({ 'radical:b': 3 });
    expect(() =>
      assignItemIds([radical('a', 'N5'), radical('b', 'N5')], [], [], [], registry),
    ).toThrow(/items: 1 key\(s\) have no id: radical:a\. .*--update-registry/);
  });

  it('gives a new key next_id, and never a retired id', () => {
    const { idByKey, section: updated } = assignItemIds(
      [radical('a', 'N5'), radical('b', 'N5')],
      [],
      [],
      [],
      section({ 'radical:b': 3 }, { next_id: 5, retired: { 'radical:gone': 4 } }),
      true,
    );
    expect(idByKey.get('radical:a')).toBe(5);
    expect(idByKey.get('radical:b')).toBe(3);
    expect(updated.next_id).toBe(6);
    expect(updated.ids).toEqual({ 'radical:b': 3, 'radical:a': 5 });
    expect(updated.retired).toEqual({ 'radical:gone': 4 });
  });

  it('fails on a registry key that left the build, and retires it with updateRegistry', () => {
    const registry = section({ 'radical:a': 1, 'radical:b': 2 });
    expect(() => resolveRegistryIds(registry, 'items', ['radical:a'], false)).toThrow(
      /1 registry key\(s\) are not in the build: radical:b/,
    );
    const { section: updated } = resolveRegistryIds(registry, 'items', ['radical:a'], true);
    expect(updated.ids).toEqual({ 'radical:a': 1 });
    expect(updated.retired).toEqual({ 'radical:b': 2 });
    expect(registry.ids).toEqual({ 'radical:a': 1, 'radical:b': 2 });
  });

  it('gives a retired key that comes back its old id', () => {
    const { idByKey, section: updated } = resolveRegistryIds(
      section({}, { retired: { 'radical:a': 4 } }),
      'items',
      ['radical:a'],
      true,
    );
    expect(idByKey.get('radical:a')).toBe(4);
    expect(updated.retired).toEqual({});
  });

  it('resolves an alias to the id of its old key', () => {
    const { idByKey } = resolveRegistryIds(
      section({ 'vocabulary:old': 9 }, { aliases: { 'vocabulary:old': 'vocabulary:new' } }),
      'items',
      ['vocabulary:new'],
      false,
    );
    expect(idByKey.get('vocabulary:new')).toBe(9);
  });

  it('fails when two keys share an id or an id is not below next_id', () => {
    expect(() =>
      resolveRegistryIds(section({ 'radical:a': 1, 'radical:b': 1 }), 'items', [], true),
    ).toThrow(/id 1 belongs to both radical:a and radical:b/);
    expect(() =>
      resolveRegistryIds(section({ 'radical:a': 1 }, { next_id: 1 }), 'items', [], true),
    ).toThrow(/radical:a has id 1, but next_id is 1/);
  });
});

describe('compile-curriculum', () => {
  it('takes item, passage and question ids from the registry', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const dbPath = path.join(tempDir, 'curriculum.db');
    compileCurriculum(dbPath, FIXTURE_DIR);
    const db = new Database(dbPath, { readonly: true });
    try {
      expect(readItemIds(dbPath)).toEqual({
        'kanji:one': 2,
        'grammar:desu': 3,
        'radical:ichi': 4,
        'vocabulary:ichi-v': 5,
        'grammar:ja-nai': 7,
      });
      expect(db.prepare('SELECT id FROM reading_passages').all()).toEqual([{ id: 4 }]);
      expect(db.prepare('SELECT id, passage_id FROM passage_questions').all()).toEqual([
        { id: 9, passage_id: 4 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps every id when an item moves to a different level', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const kanjiPath = path.join(curriculumDir, 'kanji', 'n5.json');
    fs.renameSync(kanjiPath, path.join(curriculumDir, 'kanji', 'n4.json'));
    const kanjiFile = JSON.parse(fs.readFileSync(path.join(curriculumDir, 'kanji', 'n4.json'), 'utf8'));
    kanjiFile.jlpt_level = 'N4';
    fs.writeFileSync(path.join(curriculumDir, 'kanji', 'n4.json'), JSON.stringify(kanjiFile));
    try {
      compileCurriculum(dbPath, curriculumDir);
      expect(readItemIds(dbPath)['kanji:one']).toBe(2);
      const db = new Database(dbPath, { readonly: true });
      try {
        expect(
          db.prepare("SELECT jlpt_level FROM items WHERE slug = 'one'").get(),
        ).toEqual({ jlpt_level: 'N4' });
      } finally {
        db.close();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('gives only the new item a new id, and only with updateRegistry', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const radicalsPath = path.join(curriculumDir, 'radicals', 'n5.json');
    const radicalsFile = JSON.parse(fs.readFileSync(radicalsPath, 'utf8'));
    // "aaa" sorts before every fixture item, so a positional id would move all of them.
    radicalsFile.items.unshift({ slug: 'aaa', primary_form: '丶', meaning: 'dot' });
    fs.writeFileSync(radicalsPath, JSON.stringify(radicalsFile));
    const registryPath = path.join(curriculumDir, 'id-registry.json');
    const registryBefore = fs.readFileSync(registryPath, 'utf8');
    try {
      expect(() => compileCurriculum(dbPath, curriculumDir)).toThrow(
        /items: 1 key\(s\) have no id: radical:aaa/,
      );
      expect(fs.readFileSync(registryPath, 'utf8')).toBe(registryBefore);

      compileCurriculum(dbPath, curriculumDir, { updateRegistry: true });
      expect(readItemIds(dbPath)).toEqual({
        'radical:aaa': 8,
        'kanji:one': 2,
        'grammar:desu': 3,
        'radical:ichi': 4,
        'vocabulary:ichi-v': 5,
        'grammar:ja-nai': 7,
      });
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as IdRegistry;
      expect(registry.items.ids['radical:aaa']).toBe(8);
      expect(registry.items.next_id).toBe(9);
      expect(registry.items.retired).toEqual({ 'vocabulary:removed-word': 6 });

      compileCurriculum(dbPath, curriculumDir);
      expect(readItemIds(dbPath)['radical:aaa']).toBe(8);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails without a registry file unless updateRegistry is set', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    fs.rmSync(path.join(curriculumDir, 'id-registry.json'));
    try {
      expect(() => compileCurriculum(dbPath, curriculumDir)).toThrow(
        /curriculum\/id-registry\.json not found/,
      );
      compileCurriculum(dbPath, curriculumDir, { updateRegistry: true });
      expect(fs.existsSync(path.join(curriculumDir, 'id-registry.json'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('raises metadata.json version and records the compiled content_counts', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const metadataPath = path.join(curriculumDir, 'metadata.json');
    try {
      compileAndRecordMetadata(dbPath, curriculumDir);
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      expect(metadata.version).toBe(2);
      expect(metadata.content_counts).toEqual({
        radicals: 1,
        kanji: 1,
        vocabulary: 1,
        grammar: 2,
        total_items: 5,
        reading_passages: 1,
        dependency_edges: 2,
      });

      const db = new Database(dbPath, { readonly: true });
      try {
        const count = (sql: string) => (db.prepare(sql).get() as { count: number }).count;
        expect(count('SELECT COUNT(*) AS count FROM items')).toBe(
          metadata.content_counts.total_items,
        );
        expect(count('SELECT COUNT(*) AS count FROM reading_passages')).toBe(
          metadata.content_counts.reading_passages,
        );
        expect(count('SELECT COUNT(*) AS count FROM item_relationships')).toBe(
          metadata.content_counts.dependency_edges,
        );
      } finally {
        db.close();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('leaves metadata.json unchanged when the compile fails', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const metadataPath = path.join(curriculumDir, 'metadata.json');
    const before = fs.readFileSync(metadataPath, 'utf8');
    fs.rmSync(path.join(curriculumDir, 'id-registry.json'));
    try {
      expect(() => compileAndRecordMetadata(dbPath, curriculumDir)).toThrow(
        /curriculum\/id-registry\.json not found/,
      );
      expect(fs.readFileSync(metadataPath, 'utf8')).toBe(before);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('gives a new passage question an id without moving the others', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const readingsPath = path.join(curriculumDir, 'readings', 'n5.json');
    const readingsFile = JSON.parse(fs.readFileSync(readingsPath, 'utf8'));
    readingsFile.passages[0].questions.push({ prompt: 'Why?', accepted_answers: ['because'] });
    fs.writeFileSync(readingsPath, JSON.stringify(readingsFile));
    try {
      expect(() => compileCurriculum(dbPath, curriculumDir)).toThrow(
        /passage_questions: 1 key\(s\) have no id: test-passage#1/,
      );
      compileCurriculum(dbPath, curriculumDir, { updateRegistry: true });
      const db = new Database(dbPath, { readonly: true });
      try {
        expect(
          db.prepare('SELECT id, prompt FROM passage_questions ORDER BY sort_order').all(),
        ).toEqual([
          { id: 9, prompt: 'What?' },
          { id: 10, prompt: 'Why?' },
        ]);
      } finally {
        db.close();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

      expect(metadata.version).toBe('1');
      expect(metadata.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.item_count).toBe(5);

      const itemCount = db.prepare('SELECT COUNT(*) AS count FROM items').get() as { count: number };
      const relationshipCount = db
        .prepare('SELECT COUNT(*) AS count FROM item_relationships')
        .get() as { count: number };

      expect(itemCount.count).toBe(5);
      expect(relationshipCount.count).toBe(2);

      // Plan 09: family lands on grammar_rules.
      const rule = db
        .prepare('SELECT family FROM grammar_rules WHERE structure = ?')
        .get('Noun + です') as { family: string | null };
      expect(rule.family).toBe('copula');

      const clozeTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'grammar_cloze_variants'")
        .get();
      expect(clozeTable).toBeUndefined();
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
        .get('kanji', 'one') as {
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
        { from_slug: 'ichi', to_slug: 'one' },
        { from_slug: 'one', to_slug: 'ichi' },
      ]);

      const grammarMnemonic = db
        .prepare('SELECT mnemonic_text FROM items WHERE item_type = ? AND slug = ?')
        .get('grammar', 'desu') as { mnemonic_text: string | null };
      expect(grammarMnemonic.mnemonic_text).toBe(
        'A waiter bows and says "<reading>dess</reading>": <grammar>polite is</grammar>. 本<reading>です</reading>。',
      );
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('compiles conjugation_class for vocabulary and NULL when absent or not vocabulary', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    try {
      compileCurriculum(dbPath, curriculumDir);
      const readClasses = () => {
        const db = new Database(dbPath, { readonly: true });
        try {
          return db
            .prepare('SELECT item_type, slug, conjugation_class FROM items ORDER BY id')
            .all() as { item_type: string; slug: string; conjugation_class: string | null }[];
        } finally {
          db.close();
        }
      };
      expect(readClasses().every((row) => row.conjugation_class === null)).toBe(true);

      const vocabPath = path.join(curriculumDir, 'vocabulary', 'n5.json');
      const vocabFile = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
      vocabFile.items[0].conjugation_class = 'godan';
      fs.writeFileSync(vocabPath, JSON.stringify(vocabFile));
      compileCurriculum(dbPath, curriculumDir);

      const rows = readClasses();
      expect(rows.find((row) => row.slug === 'ichi-v')?.conjugation_class).toBe('godan');
      expect(rows.filter((row) => row.conjugation_class !== null)).toHaveLength(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('compiles grammar read_once as 1 when set and 0 otherwise', () => {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    try {
      const readFlags = () => {
        const db = new Database(dbPath, { readonly: true });
        try {
          return db
            .prepare(
              `SELECT i.slug, g.read_once FROM grammar_rules g JOIN items i ON i.id = g.item_id ORDER BY i.id`,
            )
            .all() as { slug: string; read_once: number }[];
        } finally {
          db.close();
        }
      };
      compileCurriculum(dbPath, curriculumDir);
      expect(readFlags().length).toBeGreaterThan(0);
      expect(readFlags().every((row) => row.read_once === 0)).toBe(true);

      const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
      const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
      grammarFile.items[0].read_once = true;
      fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));
      compileCurriculum(dbPath, curriculumDir);

      const flags = readFlags();
      expect(flags.find((row) => row.slug === grammarFile.items[0].slug)?.read_once).toBe(1);
      expect(flags.filter((row) => row.read_once === 1)).toHaveLength(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws on an unresolved visually similar slug', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'curriculum-compile-'));
    const curriculumDir = path.join(tempDir, 'curriculum');
    fs.cpSync(FIXTURE_DIR, curriculumDir, { recursive: true });

    const kanjiPath = path.join(curriculumDir, 'kanji', 'n5.json');
    const kanjiFile = JSON.parse(fs.readFileSync(kanjiPath, 'utf8'));
    kanjiFile.items[0].visually_similar_slugs = ['kanji:no-such-item'];
    fs.writeFileSync(kanjiPath, JSON.stringify(kanjiFile));

    try {
      expect(() => compileCurriculum(path.join(tempDir, 'curriculum.db'), curriculumDir)).toThrow(
        'Unresolved visually similar link: kanji:one -> kanji:no-such-item',
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
        'Unresolved passage grammar link: test-passage -> grammar:no-such-grammar',
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
    ).toThrow('Unresolved passage word span: test-passage -> vocabulary:no-such-vocab');
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

  it('stores a stem span with a null inflection after checking the stem', () => {
    // "一があります。" — あり is a stem of the fixture's ichi-v stand-in.
    const { dbPath, tempDir, run } = compileWithExampleSpans([
      { vocabulary_slug: 'ichi-v', start: 2, end: 4, surface_form: 'あり', inflection: 'stem' },
    ]);
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const span = db
        .prepare('SELECT start_offset, end_offset, inflection FROM example_sentence_spans')
        .get();
      expect(span).toEqual({ start_offset: 2, end_offset: 4, inflection: null });
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

  function compileGrammarFixture(
    mutate?: (grammarFile: { items: Record<string, unknown>[] }) => void,
  ): { dbPath: string; tempDir: string; run: () => void } {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
    const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    mutate?.(grammarFile);
    fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));
    return { dbPath, tempDir, run: () => compileCurriculum(dbPath, curriculumDir) };
  }

  it('compiles grammar pool fields, build alternates and grammar meanings', () => {
    const { dbPath, tempDir, run } = compileGrammarFixture();
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const sentence = db
        .prepare(
          `SELECT s.id, s.grammar_start, s.grammar_end, s.register
           FROM example_sentences s JOIN items i ON i.id = s.item_id
           WHERE i.slug = 'desu'`,
        )
        .get() as { id: number; grammar_start: number; grammar_end: number; register: string };
      expect(sentence).toMatchObject({ grammar_start: 1, grammar_end: 3, register: 'polite' });

      const answers = db
        .prepare(
          `SELECT answer_furigana, kind, sort_order FROM grammar_sentence_answers
           WHERE sentence_id = ? ORDER BY sort_order`,
        )
        .all(sentence.id);
      expect(answers).toEqual([
        { answer_furigana: '一[いち]だ。', kind: 'valid', sort_order: 0 },
        { answer_furigana: '一[いち]じゃない。', kind: 'other_grammar', sort_order: 1 },
      ]);

      const meanings = db
        .prepare(
          `SELECT a.answer_text, a.is_primary FROM accepted_answers a
           JOIN items i ON i.id = a.item_id
           WHERE i.slug = 'desu' AND a.answer_type = 'meaning' ORDER BY a.id`,
        )
        .all();
      expect(meanings).toEqual([
        { answer_text: 'is', is_primary: 1 },
        { answer_text: 'copula', is_primary: 0 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const ANSWER_UNITS = [
    { surface: '一', reading: 'いち', role: 'word', vocabulary_slug: 'ichi-v', in_grammar: false },
    { surface: 'です', reading: 'です', role: 'other', in_grammar: true },
  ];

  function withAnswerUnits(
    sentenceUnits: unknown[],
    alternateUnits: unknown[],
  ): (file: { items: Record<string, unknown>[] }) => void {
    return (file) => {
      const desu = file.items[0] as {
        example_sentences: { answer_units: unknown[]; build_alternates: { units?: unknown[] }[] }[];
      };
      desu.example_sentences[0].answer_units = sentenceUnits;
      desu.example_sentences[0].build_alternates[0].units = alternateUnits;
    };
  }

  it('compiles answer units for the sentence and its valid alternates', () => {
    const alternateUnits = [
      ANSWER_UNITS[0],
      { surface: 'だ', reading: 'だ', role: 'other', in_grammar: true },
    ];
    const { dbPath, tempDir, run } = compileGrammarFixture(
      withAnswerUnits(ANSWER_UNITS, alternateUnits),
    );
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const ichiId = readItemIds(dbPath)['vocabulary:ichi-v'];
      const validAnswerId = (
        db.prepare(`SELECT id FROM grammar_sentence_answers WHERE kind = 'valid'`).get() as {
          id: number;
        }
      ).id;
      const rows = db
        .prepare(
          `SELECT answer_id, position, surface, role, item_id, in_grammar
           FROM grammar_answer_units ORDER BY answer_id IS NOT NULL, answer_id, position`,
        )
        .all();
      expect(rows).toEqual([
        { answer_id: null, position: 0, surface: '一', role: 'word', item_id: ichiId, in_grammar: 0 },
        { answer_id: null, position: 1, surface: 'です', role: 'other', item_id: null, in_grammar: 1 },
        { answer_id: validAnswerId, position: 0, surface: '一', role: 'word', item_id: ichiId, in_grammar: 0 },
        { answer_id: validAnswerId, position: 1, surface: 'だ', role: 'other', item_id: null, in_grammar: 1 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws when answer units do not rebuild the sentence', () => {
    const { tempDir, run } = compileGrammarFixture(withAnswerUnits([ANSWER_UNITS[0]], []));
    expect(run).toThrow(/Answer units do not rebuild sentence: grammar:desu example\[0\]/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when an answer unit names an unknown vocabulary word', () => {
    const { tempDir, run } = compileGrammarFixture(
      withAnswerUnits([{ ...ANSWER_UNITS[0], vocabulary_slug: 'nope' }, ANSWER_UNITS[1]], []),
    );
    expect(run).toThrow(/Unresolved answer unit vocabulary: grammar:desu example\[0\] -> vocabulary:nope/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('leaves grammar pool columns null on non-grammar example sentences', () => {
    const { dbPath, tempDir, run } = compileGrammarFixture();
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .prepare(
          `SELECT s.grammar_start, s.grammar_end, s.register FROM example_sentences s
           JOIN items i ON i.id = s.item_id WHERE i.item_type != 'grammar'`,
        )
        .all();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row).toEqual({ grammar_start: null, grammar_end: null, register: null });
      }
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function compileLessonText(
    explanationMarkdown: string,
    useWordSpans?: unknown[],
  ): { dbPath: string; tempDir: string; run: () => void } {
    return compileGrammarFixture((file) => {
      const desu = file.items[0] as Record<string, unknown>;
      desu.explanation_markdown = explanationMarkdown;
      desu.uses = [
        {
          label: 'A',
          structure: 'N です',
          japanese: '一です。',
          english: 'It is one.',
          ...(useWordSpans ? { word_spans: useWordSpans } : {}),
        },
        { label: 'B', structure: 'N です', japanese: '二です。', english: 'It is two.' },
      ];
    });
  }

  function readDesuRule(dbPath: string): { explanation_markdown: string; uses: string } {
    const db = new Database(dbPath, { readonly: true });
    try {
      return db
        .prepare(
          `SELECT r.explanation_markdown, r.uses FROM grammar_rules r
           JOIN items i ON i.id = r.item_id WHERE i.slug = 'desu'`,
        )
        .get() as { explanation_markdown: string; uses: string };
    } finally {
      db.close();
    }
  }

  it('rewrites lesson word markers to item ids', () => {
    const { dbPath, tempDir, run } = compileLessonText(
      'x {{ichi-v||一[いち]}} {{ichi-v|masu|一[いち]です}} {{ichi-v|stem|一[いち]つ}}',
    );
    run();
    const ichiId = readItemIds(dbPath)['vocabulary:ichi-v'];
    expect(readDesuRule(dbPath).explanation_markdown).toBe(
      `x {{${ichiId}||一[いち]}} {{${ichiId}|masu|一[いち]です}} {{${ichiId}||一[いち]つ}}`,
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws on a lesson marker with an unknown slug', () => {
    const { tempDir, run } = compileLessonText('x {{nope||明日[あした]}}');
    expect(run).toThrow(/Unresolved lesson word marker/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when a lesson marker text does not match its word', () => {
    const { tempDir, run } = compileLessonText('x {{ichi-v||二[に]}}');
    expect(run).toThrow(/surface mismatch/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws on a malformed lesson marker', () => {
    const { tempDir, run } = compileLessonText('x {{ichi-v|一');
    expect(run).toThrow(/Malformed lesson word marker/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function compileMnemonicText(mnemonicText: string): {
    dbPath: string;
    tempDir: string;
    run: () => void;
  } {
    return compileGrammarFixture((file) => {
      (file.items[0] as Record<string, unknown>).mnemonic_text = mnemonicText;
    });
  }

  function readDesuMnemonic(dbPath: string): string {
    const db = new Database(dbPath, { readonly: true });
    try {
      const row = db
        .prepare("SELECT mnemonic_text FROM items WHERE item_type = 'grammar' AND slug = 'desu'")
        .get() as { mnemonic_text: string };
      return row.mnemonic_text;
    } finally {
      db.close();
    }
  }

  it('rewrites mnemonic word markers to item ids', () => {
    const { dbPath, tempDir, run } = compileMnemonicText(
      'Sei says "<reading>dess</reading>". {{ichi-v||一}}<reading>です</reading>。',
    );
    run();
    const ichiId = readItemIds(dbPath)['vocabulary:ichi-v'];
    expect(readDesuMnemonic(dbPath)).toBe(
      `Sei says "<reading>dess</reading>". {{${ichiId}||一}}<reading>です</reading>。`,
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws on a mnemonic marker with an unknown slug', () => {
    const { tempDir, run } = compileMnemonicText('x {{nope||一}}<reading>です</reading>。');
    expect(run).toThrow(/Unresolved lesson word marker/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws on a malformed mnemonic marker', () => {
    const { tempDir, run } = compileMnemonicText('x {{ichi-v|一<reading>です</reading>。');
    expect(run).toThrow(/Malformed lesson word marker/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores uses word spans with item ids', () => {
    const { dbPath, tempDir, run } = compileLessonText('plain', [
      { vocabulary_slug: 'ichi-v', start: 0, end: 1 },
      { vocabulary_slug: 'ichi-v', start: 1, end: 3, surface_form: 'です', inflection: 'stem' },
    ]);
    run();
    const ichiId = readItemIds(dbPath)['vocabulary:ichi-v'];
    const uses = JSON.parse(readDesuRule(dbPath).uses);
    expect(uses[0].word_spans).toEqual([
      { vocabulary_item_id: ichiId, start: 0, end: 1, inflection: null },
      { vocabulary_item_id: ichiId, start: 1, end: 3, inflection: null },
    ]);
    expect(uses[0].label).toBe('A');
    expect(uses[1]).not.toHaveProperty('word_spans');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when a uses word span does not match its text', () => {
    const { tempDir, run } = compileLessonText('plain', [
      { vocabulary_slug: 'ichi-v', start: 1, end: 2 },
    ]);
    expect(run).toThrow(/surface mismatch/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws on a grammar span outside its sentence', () => {
    const { tempDir, run } = compileGrammarFixture((file) => {
      const desu = file.items[0] as { example_sentences: { grammar_span: unknown }[] };
      desu.example_sentences[0].grammar_span = { start: 2, end: 9 };
    });
    expect(run).toThrow(/Grammar span out of range: grammar:desu example\[0\]/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
