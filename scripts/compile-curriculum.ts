import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

import { CURRICULUM_DDL, type ItemType, type RelationshipType } from './curriculum-schema';
import { validateCurriculum } from './validate-schema';

const REPO_ROOT = process.cwd();
const CURRICULUM_DIR = path.join(REPO_ROOT, 'curriculum');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'mobile', 'assets', 'curriculum-seed', 'curriculum.db');

const ITEM_TYPE_ORDER: Record<ItemType, number> = {
  radical: 0,
  kanji: 1,
  vocabulary: 2,
  grammar: 3,
};

type MetadataJson = {
  version: string;
  jlpt_levels: string[];
  description: string;
  maintainer_notes?: string;
  content_counts?: Record<string, number>;
};

type RadicalItem = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  visual_mnemonic_url: string;
  sort_order?: number;
};

type KanjiReading = {
  reading_type: 'onyomi' | 'kunyomi';
  reading: string;
  sort_order?: number;
};

type AcceptedAnswer = {
  answer_type: 'meaning' | 'reading' | 'production';
  answer_text: string;
  is_primary?: boolean;
};

type KanjiItem = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  sort_order?: number;
  readings?: KanjiReading[];
  accepted_answers?: AcceptedAnswer[];
};

type VocabItem = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  sort_order?: number;
  accepted_answers?: AcceptedAnswer[];
};

type ExampleSentence = {
  japanese: string;
  english: string;
  sort_order?: number;
  reinforcement_tags?: string[];
  vocabulary_slugs?: string[];
};

type GrammarItem = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  sort_order?: number;
  structure: string;
  conjugation_rules: Record<string, unknown>;
  accepted_forms: string[];
  example_sentences?: ExampleSentence[];
  vocabulary_slugs?: string[];
};

type PassageQuestion = {
  prompt: string;
  accepted_answers: string[];
  sort_order?: number;
};

type ReadingPassage = {
  slug?: string;
  title: string;
  body: string;
  sort_order?: number;
  questions?: PassageQuestion[];
};

type DependencyEdge = {
  from_slug: string;
  from_type: ItemType;
  to_slug: string;
  to_type: ItemType;
  relationship_type: RelationshipType;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function discoverContentHashFiles(curriculumDir: string): string[] {
  const files: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'schema') {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  walk(curriculumDir);
  return files.sort();
}

export function computeContentHash(files: string[], baseDir: string): string {
  const hash = createHash('sha256');
  for (const filePath of files) {
    hash.update(path.relative(baseDir, filePath));
    hash.update('\0');
    hash.update(fs.readFileSync(filePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function itemKey(itemType: ItemType, slug: string): string {
  return `${itemType}:${slug}`;
}

export function assignItemIds(
  radicals: RadicalItem[],
  kanji: KanjiItem[],
  vocabulary: VocabItem[],
  grammar: GrammarItem[],
): Map<string, number> {
  const sorted = [
    ...radicals.map((item) => ({ itemType: 'radical' as const, slug: item.slug })),
    ...kanji.map((item) => ({ itemType: 'kanji' as const, slug: item.slug })),
    ...vocabulary.map((item) => ({ itemType: 'vocabulary' as const, slug: item.slug })),
    ...grammar.map((item) => ({ itemType: 'grammar' as const, slug: item.slug })),
  ].sort((a, b) => {
    const typeDiff = ITEM_TYPE_ORDER[a.itemType] - ITEM_TYPE_ORDER[b.itemType];
    if (typeDiff !== 0) {
      return typeDiff;
    }
    return a.slug.localeCompare(b.slug);
  });

  const idByKey = new Map<string, number>();
  sorted.forEach((entry, index) => {
    idByKey.set(itemKey(entry.itemType, entry.slug), index + 1);
  });
  return idByKey;
}

export function compileCurriculum(
  outputPath: string,
  curriculumDir: string = CURRICULUM_DIR,
): void {
  const validation = validateCurriculum(curriculumDir);
  if (!validation.ok) {
    throw new Error(
      `Curriculum validation failed (${validation.errors.length} error(s)):\n${validation.errors.join('\n')}`,
    );
  }

  const metadata = readJson<MetadataJson>(path.join(curriculumDir, 'metadata.json'));
  const radicalsFile = readJson<{ jlpt_level: string; items: RadicalItem[] }>(
    path.join(curriculumDir, 'radicals', 'n5.json'),
  );
  const kanjiFile = readJson<{ jlpt_level: string; items: KanjiItem[] }>(
    path.join(curriculumDir, 'kanji', 'n5.json'),
  );
  const vocabularyFile = readJson<{ jlpt_level: string; items: VocabItem[] }>(
    path.join(curriculumDir, 'vocabulary', 'n5.json'),
  );
  const grammarFile = readJson<{ jlpt_level: string; items: GrammarItem[] }>(
    path.join(curriculumDir, 'grammar', 'n5.json'),
  );
  const readingsFile = readJson<{ jlpt_level: string; passages: ReadingPassage[] }>(
    path.join(curriculumDir, 'readings', 'n5.json'),
  );
  const dependenciesFile = readJson<{ edges: DependencyEdge[] }>(
    path.join(curriculumDir, 'dependencies', 'graph.json'),
  );

  const jlptLevel = radicalsFile.jlpt_level;
  const idByKey = assignItemIds(
    radicalsFile.items,
    kanjiFile.items,
    vocabularyFile.items,
    grammarFile.items,
  );

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  const tempPath = `${outputPath}.tmp`;

  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }

  const db = new Database(tempPath);
  try {
    db.exec(CURRICULUM_DDL);

    const insertItem = db.prepare(`
      INSERT INTO items (id, item_type, jlpt_level, slug, primary_form, meaning, mnemonic_text, visual_mnemonic_url, sort_order)
      VALUES (@id, @item_type, @jlpt_level, @slug, @primary_form, @meaning, @mnemonic_text, @visual_mnemonic_url, @sort_order)
    `);

    for (const radical of radicalsFile.items) {
      const id = idByKey.get(itemKey('radical', radical.slug))!;
      insertItem.run({
        id,
        item_type: 'radical',
        jlpt_level: jlptLevel,
        slug: radical.slug,
        primary_form: radical.primary_form,
        meaning: radical.meaning,
        mnemonic_text: radical.mnemonic_text ?? null,
        visual_mnemonic_url: radical.visual_mnemonic_url,
        sort_order: radical.sort_order ?? 0,
      });
    }

    const insertReading = db.prepare(`
      INSERT INTO kanji_readings (item_id, reading_type, reading, sort_order)
      VALUES (@item_id, @reading_type, @reading, @sort_order)
    `);
    const insertAnswer = db.prepare(`
      INSERT INTO accepted_answers (item_id, answer_type, answer_text, is_primary)
      VALUES (@item_id, @answer_type, @answer_text, @is_primary)
    `);

    for (const kanji of kanjiFile.items) {
      const id = idByKey.get(itemKey('kanji', kanji.slug))!;
      insertItem.run({
        id,
        item_type: 'kanji',
        jlpt_level: jlptLevel,
        slug: kanji.slug,
        primary_form: kanji.primary_form,
        meaning: kanji.meaning,
        mnemonic_text: kanji.mnemonic_text ?? null,
        visual_mnemonic_url: null,
        sort_order: kanji.sort_order ?? 0,
      });

      for (const [index, reading] of (kanji.readings ?? []).entries()) {
        insertReading.run({
          item_id: id,
          reading_type: reading.reading_type,
          reading: reading.reading,
          sort_order: reading.sort_order ?? index,
        });
      }

      for (const answer of kanji.accepted_answers ?? []) {
        insertAnswer.run({
          item_id: id,
          answer_type: answer.answer_type,
          answer_text: answer.answer_text,
          is_primary: answer.is_primary ? 1 : 0,
        });
      }
    }

    for (const vocab of vocabularyFile.items) {
      const id = idByKey.get(itemKey('vocabulary', vocab.slug))!;
      insertItem.run({
        id,
        item_type: 'vocabulary',
        jlpt_level: jlptLevel,
        slug: vocab.slug,
        primary_form: vocab.primary_form,
        meaning: vocab.meaning,
        mnemonic_text: vocab.mnemonic_text ?? null,
        visual_mnemonic_url: null,
        sort_order: vocab.sort_order ?? 0,
      });

      for (const answer of vocab.accepted_answers ?? []) {
        insertAnswer.run({
          item_id: id,
          answer_type: answer.answer_type,
          answer_text: answer.answer_text,
          is_primary: answer.is_primary ? 1 : 0,
        });
      }
    }

    const insertGrammarRule = db.prepare(`
      INSERT INTO grammar_rules (item_id, structure, conjugation_rules, accepted_forms)
      VALUES (@item_id, @structure, @conjugation_rules, @accepted_forms)
    `);
    const insertExample = db.prepare(`
      INSERT INTO example_sentences (item_id, japanese, english, sort_order, reinforcement_tags)
      VALUES (@item_id, @japanese, @english, @sort_order, @reinforcement_tags)
    `);
    const insertGrammarVocabLink = db.prepare(`
      INSERT INTO grammar_vocabulary_links (grammar_item_id, vocabulary_item_id)
      VALUES (@grammar_item_id, @vocabulary_item_id)
    `);

    for (const grammar of grammarFile.items) {
      const id = idByKey.get(itemKey('grammar', grammar.slug))!;
      insertItem.run({
        id,
        item_type: 'grammar',
        jlpt_level: jlptLevel,
        slug: grammar.slug,
        primary_form: grammar.primary_form,
        meaning: grammar.meaning,
        mnemonic_text: grammar.mnemonic_text ?? null,
        visual_mnemonic_url: null,
        sort_order: grammar.sort_order ?? 0,
      });

      insertGrammarRule.run({
        item_id: id,
        structure: grammar.structure,
        conjugation_rules: JSON.stringify(grammar.conjugation_rules),
        accepted_forms: JSON.stringify(grammar.accepted_forms),
      });

      for (const [index, sentence] of (grammar.example_sentences ?? []).entries()) {
        insertExample.run({
          item_id: id,
          japanese: sentence.japanese,
          english: sentence.english,
          sort_order: sentence.sort_order ?? index,
          reinforcement_tags: sentence.reinforcement_tags
            ? JSON.stringify(sentence.reinforcement_tags)
            : null,
        });
      }

      for (const vocabSlug of grammar.vocabulary_slugs ?? []) {
        const vocabId = idByKey.get(itemKey('vocabulary', vocabSlug));
        if (!vocabId) {
          throw new Error(
            `Unresolved grammar vocabulary link: ${grammar.slug} -> vocabulary:${vocabSlug}`,
          );
        }
        insertGrammarVocabLink.run({
          grammar_item_id: id,
          vocabulary_item_id: vocabId,
        });
      }
    }

    const insertRelationship = db.prepare(`
      INSERT INTO item_relationships (parent_item_id, child_item_id, relationship_type)
      VALUES (@parent_item_id, @child_item_id, @relationship_type)
    `);

    for (const edge of dependenciesFile.edges) {
      const parentId = idByKey.get(itemKey(edge.from_type, edge.from_slug));
      const childId = idByKey.get(itemKey(edge.to_type, edge.to_slug));
      if (!parentId || !childId) {
        throw new Error(
          `Unresolved dependency edge: ${edge.from_type}:${edge.from_slug} -> ${edge.to_type}:${edge.to_slug}`,
        );
      }
      insertRelationship.run({
        parent_item_id: parentId,
        child_item_id: childId,
        relationship_type: edge.relationship_type,
      });
    }

    const insertPassage = db.prepare(`
      INSERT INTO reading_passages (jlpt_level, title, body, sort_order)
      VALUES (@jlpt_level, @title, @body, @sort_order)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO passage_questions (passage_id, prompt, accepted_answers, sort_order)
      VALUES (@passage_id, @prompt, @accepted_answers, @sort_order)
    `);

    for (const [index, passage] of readingsFile.passages.entries()) {
      const passageResult = insertPassage.run({
        jlpt_level: readingsFile.jlpt_level,
        title: passage.title,
        body: passage.body,
        sort_order: passage.sort_order ?? index,
      });
      const passageId = Number(passageResult.lastInsertRowid);

      for (const [qIndex, question] of (passage.questions ?? []).entries()) {
        insertQuestion.run({
          passage_id: passageId,
          prompt: question.prompt,
          accepted_answers: JSON.stringify(question.accepted_answers),
          sort_order: question.sort_order ?? qIndex,
        });
      }
    }

    const contentHash = computeContentHash(discoverContentHashFiles(curriculumDir), curriculumDir);
    const radicalCount = radicalsFile.items.length;
    const kanjiCount = kanjiFile.items.length;
    const vocabularyCount = vocabularyFile.items.length;
    const grammarCount = grammarFile.items.length;
    const itemCount = radicalCount + kanjiCount + vocabularyCount + grammarCount;

    db.prepare(`
      INSERT INTO curriculum_metadata (
        version, build_date, content_hash, item_count,
        radical_count, kanji_count, vocabulary_count, grammar_count
      ) VALUES (
        @version, @build_date, @content_hash, @item_count,
        @radical_count, @kanji_count, @vocabulary_count, @grammar_count
      )
    `).run({
      version: metadata.version,
      build_date: new Date().toISOString(),
      content_hash: contentHash,
      item_count: itemCount,
      radical_count: radicalCount,
      kanji_count: kanjiCount,
      vocabulary_count: vocabularyCount,
      grammar_count: grammarCount,
    });
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  } finally {
    db.close();
  }

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  fs.renameSync(tempPath, outputPath);
}

function main(): void {
  const outputPath = process.env.COMPILE_OUTPUT_PATH
    ? path.resolve(process.env.COMPILE_OUTPUT_PATH)
    : DEFAULT_OUTPUT;

  try {
    compileCurriculum(outputPath);
    console.log(`Compiled curriculum database: ${outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1]?.includes('compile-curriculum')) {
  main();
}
