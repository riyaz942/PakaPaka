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

const JLPT_LEVEL_ORDER: Record<string, number> = {
  N5: 0,
  N4: 1,
  N3: 2,
  N2: 3,
  N1: 4,
};

function levelRank(level: string): number {
  return JLPT_LEVEL_ORDER[level] ?? 99;
}

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
  accepted_answers?: AcceptedAnswer[];
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
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
  description?: string;
  visual_mnemonic_url?: string;
  sort_order?: number;
  readings?: KanjiReading[];
  accepted_answers?: AcceptedAnswer[];
};

type VocabItem = {
  slug: string;
  primary_form: string;
  furigana?: string;
  meaning: string;
  mnemonic_text?: string;
  sort_order?: number;
  accepted_answers?: AcceptedAnswer[];
};

type ExampleSentence = {
  japanese: string;
  furigana?: string;
  english: string;
  sort_order?: number;
  reinforcement_tags?: string[];
  vocabulary_slugs?: string[];
};

type GrammarClozeVariant = {
  jp_cloze: string;
  english: string;
  answer: string;
  nudge: string;
  sort_order?: number;
};

type GrammarItem = {
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  explanation_markdown?: string;
  caution_notes?: string[];
  related_grammar_slugs?: string[];
  sort_order?: number;
  structure: string;
  conjugation_rules: Record<string, unknown>;
  accepted_forms: string[];
  family?: 'particles' | 'copula' | 'conjugations' | 'connectors' | 'patterns';
  cloze_variants?: GrammarClozeVariant[];
  example_sentences?: ExampleSentence[];
  vocabulary_slugs?: string[];
};

type PassageQuestion = {
  prompt: string;
  prompt_furigana?: string;
  accepted_answers: string[];
  sort_order?: number;
};

type ReadingPassage = {
  slug?: string;
  title: string;
  body: string;
  body_furigana?: string;
  english_translation?: string;
  grammar_slugs?: string[];
  vocabulary_slugs?: string[];
  word_count?: number;
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

function discoverJsonFilesInDir(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(dir, name));
}

function loadMergedItems<T>(
  curriculumDir: string,
  subdir: string,
): (T & { jlpt_level: string })[] {
  const dir = path.join(curriculumDir, subdir);
  const items: (T & { jlpt_level: string })[] = [];
  for (const filePath of discoverJsonFilesInDir(dir)) {
    const file = readJson<{ jlpt_level: string; items: T[] }>(filePath);
    for (const item of file.items) {
      items.push({ ...item, jlpt_level: file.jlpt_level });
    }
  }
  return items;
}

function loadMergedPassages(curriculumDir: string): { jlpt_level: string; passages: ReadingPassage[] }[] {
  const dir = path.join(curriculumDir, 'readings');
  const files: { jlpt_level: string; passages: ReadingPassage[] }[] = [];
  for (const filePath of discoverJsonFilesInDir(dir)) {
    files.push(readJson<{ jlpt_level: string; passages: ReadingPassage[] }>(filePath));
  }
  return files;
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

type ItemWithLevel = { itemType: ItemType; slug: string; jlpt_level: string };

export function assignItemIds(
  radicals: (RadicalItem & { jlpt_level: string })[],
  kanji: (KanjiItem & { jlpt_level: string })[],
  vocabulary: (VocabItem & { jlpt_level: string })[],
  grammar: (GrammarItem & { jlpt_level: string })[],
): Map<string, number> {
  const sorted: ItemWithLevel[] = [
    ...radicals.map((item) => ({
      itemType: 'radical' as const,
      slug: item.slug,
      jlpt_level: item.jlpt_level,
    })),
    ...kanji.map((item) => ({
      itemType: 'kanji' as const,
      slug: item.slug,
      jlpt_level: item.jlpt_level,
    })),
    ...vocabulary.map((item) => ({
      itemType: 'vocabulary' as const,
      slug: item.slug,
      jlpt_level: item.jlpt_level,
    })),
    ...grammar.map((item) => ({
      itemType: 'grammar' as const,
      slug: item.slug,
      jlpt_level: item.jlpt_level,
    })),
  ].sort((a, b) => {
    const levelDiff = levelRank(a.jlpt_level) - levelRank(b.jlpt_level);
    if (levelDiff !== 0) {
      return levelDiff;
    }
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
  for (const warning of validation.warnings) {
    console.warn(`warning: ${warning}`);
  }
  if (!validation.ok) {
    throw new Error(
      `Curriculum validation failed (${validation.errors.length} error(s)):\n${validation.errors.join('\n')}`,
    );
  }

  const metadata = readJson<MetadataJson>(path.join(curriculumDir, 'metadata.json'));
  const radicals = loadMergedItems<RadicalItem>(curriculumDir, 'radicals');
  const kanji = loadMergedItems<KanjiItem>(curriculumDir, 'kanji');
  const vocabulary = loadMergedItems<VocabItem>(curriculumDir, 'vocabulary');
  const grammar = loadMergedItems<GrammarItem>(curriculumDir, 'grammar');
  const readingsFiles = loadMergedPassages(curriculumDir);
  const dependenciesFile = readJson<{ edges: DependencyEdge[] }>(
    path.join(curriculumDir, 'dependencies', 'graph.json'),
  );

  const idByKey = assignItemIds(radicals, kanji, vocabulary, grammar);

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
      INSERT INTO items (id, item_type, jlpt_level, slug, primary_form, furigana, meaning, mnemonic_text, meaning_mnemonic, reading_mnemonic, description, visual_mnemonic_url, sort_order)
      VALUES (@id, @item_type, @jlpt_level, @slug, @primary_form, @furigana, @meaning, @mnemonic_text, @meaning_mnemonic, @reading_mnemonic, @description, @visual_mnemonic_url, @sort_order)
    `);

    const insertReading = db.prepare(`
      INSERT INTO kanji_readings (item_id, reading_type, reading, sort_order)
      VALUES (@item_id, @reading_type, @reading, @sort_order)
    `);
    const insertAnswer = db.prepare(`
      INSERT INTO accepted_answers (item_id, answer_type, answer_text, is_primary)
      VALUES (@item_id, @answer_type, @answer_text, @is_primary)
    `);

    for (const radical of radicals) {
      const id = idByKey.get(itemKey('radical', radical.slug))!;
      insertItem.run({
        id,
        item_type: 'radical',
        jlpt_level: radical.jlpt_level,
        slug: radical.slug,
        primary_form: radical.primary_form,
        furigana: null,
        meaning: radical.meaning,
        mnemonic_text: radical.mnemonic_text ?? null,
        meaning_mnemonic: null,
        reading_mnemonic: null,
        description: null,
        visual_mnemonic_url: radical.visual_mnemonic_url,
        sort_order: radical.sort_order ?? 0,
      });

      for (const answer of radical.accepted_answers ?? []) {
        insertAnswer.run({
          item_id: id,
          answer_type: answer.answer_type,
          answer_text: answer.answer_text,
          is_primary: answer.is_primary ? 1 : 0,
        });
      }
    }

    for (const kanjiItem of kanji) {
      const id = idByKey.get(itemKey('kanji', kanjiItem.slug))!;
      insertItem.run({
        id,
        item_type: 'kanji',
        jlpt_level: kanjiItem.jlpt_level,
        slug: kanjiItem.slug,
        primary_form: kanjiItem.primary_form,
        furigana: null,
        meaning: kanjiItem.meaning,
        mnemonic_text: kanjiItem.mnemonic_text ?? null,
        meaning_mnemonic: kanjiItem.meaning_mnemonic ?? null,
        reading_mnemonic: kanjiItem.reading_mnemonic ?? null,
        description: kanjiItem.description ?? null,
        visual_mnemonic_url: kanjiItem.visual_mnemonic_url ?? null,
        sort_order: kanjiItem.sort_order ?? 0,
      });

      for (const [index, reading] of (kanjiItem.readings ?? []).entries()) {
        insertReading.run({
          item_id: id,
          reading_type: reading.reading_type,
          reading: reading.reading,
          sort_order: reading.sort_order ?? index,
        });
      }

      for (const answer of kanjiItem.accepted_answers ?? []) {
        insertAnswer.run({
          item_id: id,
          answer_type: answer.answer_type,
          answer_text: answer.answer_text,
          is_primary: answer.is_primary ? 1 : 0,
        });
      }
    }

    for (const vocab of vocabulary) {
      const id = idByKey.get(itemKey('vocabulary', vocab.slug))!;
      insertItem.run({
        id,
        item_type: 'vocabulary',
        jlpt_level: vocab.jlpt_level,
        slug: vocab.slug,
        primary_form: vocab.primary_form,
        furigana: vocab.furigana ?? null,
        meaning: vocab.meaning,
        mnemonic_text: vocab.mnemonic_text ?? null,
        meaning_mnemonic: null,
        reading_mnemonic: null,
        description: null,
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
      INSERT INTO grammar_rules (item_id, structure, conjugation_rules, accepted_forms, family, explanation_markdown, caution_notes)
      VALUES (@item_id, @structure, @conjugation_rules, @accepted_forms, @family, @explanation_markdown, @caution_notes)
    `);
    const insertGrammarRelatedLink = db.prepare(`
      INSERT INTO grammar_related_links (grammar_item_id, related_item_id, sort_order)
      VALUES (@grammar_item_id, @related_item_id, @sort_order)
    `);
    const insertClozeVariant = db.prepare(`
      INSERT INTO grammar_cloze_variants (item_id, jp_cloze, english, answer, nudge, sort_order)
      VALUES (@item_id, @jp_cloze, @english, @answer, @nudge, @sort_order)
    `);
    const insertExample = db.prepare(`
      INSERT INTO example_sentences (item_id, japanese, furigana, english, sort_order, reinforcement_tags)
      VALUES (@item_id, @japanese, @furigana, @english, @sort_order, @reinforcement_tags)
    `);
    const insertGrammarVocabLink = db.prepare(`
      INSERT INTO grammar_vocabulary_links (grammar_item_id, vocabulary_item_id)
      VALUES (@grammar_item_id, @vocabulary_item_id)
    `);

    // Related grammar can point at items later in the compile order, so the
    // links are inserted after every grammar item row exists.
    const pendingRelatedLinks: {
      grammar_item_id: number;
      related_item_id: number;
      sort_order: number;
    }[] = [];

    for (const grammarItem of grammar) {
      const id = idByKey.get(itemKey('grammar', grammarItem.slug))!;
      insertItem.run({
        id,
        item_type: 'grammar',
        jlpt_level: grammarItem.jlpt_level,
        slug: grammarItem.slug,
        primary_form: grammarItem.primary_form,
        furigana: null,
        meaning: grammarItem.meaning,
        mnemonic_text: grammarItem.mnemonic_text ?? null,
        meaning_mnemonic: null,
        reading_mnemonic: null,
        description: null,
        visual_mnemonic_url: null,
        sort_order: grammarItem.sort_order ?? 0,
      });

      insertGrammarRule.run({
        item_id: id,
        structure: grammarItem.structure,
        conjugation_rules: JSON.stringify(grammarItem.conjugation_rules),
        accepted_forms: JSON.stringify(grammarItem.accepted_forms),
        family: grammarItem.family ?? null,
        explanation_markdown: grammarItem.explanation_markdown ?? null,
        caution_notes: grammarItem.caution_notes
          ? JSON.stringify(grammarItem.caution_notes)
          : null,
      });

      for (const [index, relatedSlug] of (grammarItem.related_grammar_slugs ?? []).entries()) {
        const relatedId = idByKey.get(itemKey('grammar', relatedSlug));
        if (!relatedId) {
          throw new Error(
            `Unresolved related grammar link: ${grammarItem.slug} -> grammar:${relatedSlug}`,
          );
        }
        pendingRelatedLinks.push({
          grammar_item_id: id,
          related_item_id: relatedId,
          sort_order: index,
        });
      }

      for (const [index, variant] of (grammarItem.cloze_variants ?? []).entries()) {
        insertClozeVariant.run({
          item_id: id,
          jp_cloze: variant.jp_cloze,
          english: variant.english,
          answer: variant.answer,
          nudge: variant.nudge,
          sort_order: variant.sort_order ?? index,
        });
      }

      for (const [index, sentence] of (grammarItem.example_sentences ?? []).entries()) {
        insertExample.run({
          item_id: id,
          japanese: sentence.japanese,
          furigana: sentence.furigana ?? null,
          english: sentence.english,
          sort_order: sentence.sort_order ?? index,
          reinforcement_tags: sentence.reinforcement_tags
            ? JSON.stringify(sentence.reinforcement_tags)
            : null,
        });
      }

      for (const vocabSlug of grammarItem.vocabulary_slugs ?? []) {
        const vocabId = idByKey.get(itemKey('vocabulary', vocabSlug));
        if (!vocabId) {
          throw new Error(
            `Unresolved grammar vocabulary link: ${grammarItem.slug} -> vocabulary:${vocabSlug}`,
          );
        }
        insertGrammarVocabLink.run({
          grammar_item_id: id,
          vocabulary_item_id: vocabId,
        });
      }
    }

    for (const link of pendingRelatedLinks) {
      insertGrammarRelatedLink.run(link);
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
      INSERT INTO reading_passages (jlpt_level, title, body, body_furigana, english_translation, word_count, sort_order)
      VALUES (@jlpt_level, @title, @body, @body_furigana, @english_translation, @word_count, @sort_order)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO passage_questions (passage_id, prompt, prompt_furigana, accepted_answers, sort_order)
      VALUES (@passage_id, @prompt, @prompt_furigana, @accepted_answers, @sort_order)
    `);
    const insertPassageGrammarLink = db.prepare(`
      INSERT INTO passage_grammar_links (passage_id, grammar_item_id)
      VALUES (@passage_id, @grammar_item_id)
    `);
    const insertPassageVocabLink = db.prepare(`
      INSERT INTO passage_vocabulary_links (passage_id, vocabulary_item_id)
      VALUES (@passage_id, @vocabulary_item_id)
    `);

    for (const readingsFile of readingsFiles) {
      for (const [index, passage] of readingsFile.passages.entries()) {
        const passageResult = insertPassage.run({
          jlpt_level: readingsFile.jlpt_level,
          title: passage.title,
          body: passage.body,
          body_furigana: passage.body_furigana ?? null,
          english_translation: passage.english_translation ?? null,
          word_count: passage.word_count ?? null,
          sort_order: passage.sort_order ?? index,
        });
        const passageId = Number(passageResult.lastInsertRowid);
        const passageLabel = passage.slug ?? passage.title;

        for (const grammarSlug of passage.grammar_slugs ?? []) {
          const grammarId = idByKey.get(itemKey('grammar', grammarSlug));
          if (!grammarId) {
            throw new Error(
              `Unresolved passage grammar link: ${passageLabel} -> grammar:${grammarSlug}`,
            );
          }
          insertPassageGrammarLink.run({ passage_id: passageId, grammar_item_id: grammarId });
        }

        for (const vocabSlug of passage.vocabulary_slugs ?? []) {
          const vocabId = idByKey.get(itemKey('vocabulary', vocabSlug));
          if (!vocabId) {
            throw new Error(
              `Unresolved passage vocabulary link: ${passageLabel} -> vocabulary:${vocabSlug}`,
            );
          }
          insertPassageVocabLink.run({ passage_id: passageId, vocabulary_item_id: vocabId });
        }

        for (const [qIndex, question] of (passage.questions ?? []).entries()) {
          insertQuestion.run({
            passage_id: passageId,
            prompt: question.prompt,
            prompt_furigana: question.prompt_furigana ?? null,
            accepted_answers: JSON.stringify(question.accepted_answers),
            sort_order: question.sort_order ?? qIndex,
          });
        }
      }
    }

    const contentHash = computeContentHash(discoverContentHashFiles(curriculumDir), curriculumDir);
    const radicalCount = radicals.length;
    const kanjiCount = kanji.length;
    const vocabularyCount = vocabulary.length;
    const grammarCount = grammar.length;
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
