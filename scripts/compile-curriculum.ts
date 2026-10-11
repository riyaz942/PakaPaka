import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

import { CURRICULUM_DDL, type ItemType, type RelationshipType } from './curriculum-schema';
import {
  emptyIdRegistrySection,
  ID_REGISTRY_FILE,
  type IdRegistry,
  type IdRegistrySection,
  readIdRegistry,
  resolveRegistryIds,
  writeIdRegistry,
} from './id-registry';
import { SIDECAR_FILE_NAMES, validateCurriculum } from './validate-schema';

const REPO_ROOT = process.cwd();
const CURRICULUM_DIR = path.join(REPO_ROOT, 'curriculum');
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'mobile', 'assets', 'curriculum-seed', 'curriculum.db');
const SEED_INFO_FILE = 'curriculum-seed.json';

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
  version: number;
  jlpt_levels: string[];
  description: string;
  maintainer_notes?: string;
  content_counts?: ContentCounts;
};

/** What one compile wrote; `metadata.json` `content_counts` records it. */
export type ContentCounts = {
  radicals: number;
  kanji: number;
  vocabulary: number;
  grammar: number;
  total_items: number;
  reading_passages: number;
  dependency_edges: number;
};

/**
 * Sidecar review metadata on generated content (content pipeline Phase 0.5).
 * Never written to curriculum.db; only `review_status` is inspected so
 * unreviewed prose can't silently ship.
 */
type SidecarMeta = {
  generator_model?: string;
  prompt_version?: string;
  review_status?: 'draft' | 'reviewed' | 'flagged_for_rewrite';
  reviewed_by?: string;
};

type RadicalItem = {
  _meta?: SidecarMeta;
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  description?: string;
  visually_similar_slugs?: string[];
  visual_mnemonic_url?: string;
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
  _meta?: SidecarMeta;
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text?: string;
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
  description?: string;
  visually_similar_slugs?: string[];
  sort_order?: number;
  readings?: KanjiReading[];
  accepted_answers?: AcceptedAnswer[];
  example_sentences?: ExampleSentence[];
};

type VocabItem = {
  _meta?: SidecarMeta;
  slug: string;
  primary_form: string;
  furigana?: string;
  meaning: string;
  word_type?: string;
  reading_composition?: string;
  mnemonic_text?: string;
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
  description?: string;
  sort_order?: number;
  accepted_answers?: AcceptedAnswer[];
  example_sentences?: ExampleSentence[];
};

type ExampleSentence = {
  japanese: string;
  furigana?: string;
  english: string;
  sort_order?: number;
  reinforcement_tags?: string[];
  vocabulary_slugs?: string[];
  word_spans?: WordSpan[];
};

type GrammarClozeVariant = {
  jp_cloze: string;
  /** Bracket-notation cloze with blank preserved; optional (Plan 11.8). */
  jp_cloze_furigana?: string;
  english: string;
  answer: string;
  nudge: string;
  sort_order?: number;
};

type GrammarUse = {
  label: string;
  structure: string;
  japanese: string;
  furigana?: string;
  english: string;
};

type GrammarItem = {
  _meta?: SidecarMeta;
  slug: string;
  primary_form: string;
  meaning: string;
  explanation_markdown?: string;
  caution_notes?: string[];
  uses?: GrammarUse[];
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

/** The inflection families the N5/N4 grammar curriculum teaches (feedback 14.1a). */
const TAUGHT_INFLECTIONS = new Set(['masu', 'te', 'nai', 'ta']);

/**
 * Derived word boundary into a passage `body` or an example sentence's
 * `japanese`. `start`/`end` are UTF-16 (JavaScript string) indices, inclusive
 * start and exclusive end, measured against the plain text — never against the
 * `furigana` markup.
 *
 * A dictionary-form span carries neither extra field and its surface must be
 * the item's `primary_form`. An inflected span carries both: `surface_form` is
 * the conjugated text it claims to cover (来ます) and `inflection` names the
 * taught family. The item is the *base* word in either case.
 */
type WordSpan = {
  vocabulary_slug: string;
  start: number;
  end: number;
  surface_form?: string;
  inflection?: string;
};

/**
 * The prefix every taught inflection of `primaryForm` keeps — mirrors
 * `inflection_stem` in `curriculum/_build/generate_content/spans.py`. Checking
 * it here is what makes an inflected span verifiable without a tokenizer.
 */
function inflectionStem(primaryForm: string): string {
  return primaryForm.endsWith('する') ? primaryForm.slice(0, -2) : primaryForm.slice(0, -1);
}

type ResolvedWordSpan = {
  item_id: number;
  start_offset: number;
  end_offset: number;
  inflection: string | null;
  sort_order: number;
};

/**
 * Word spans in text order, checked against the text they claim to cover.
 * `kind` only shapes the error messages ("passage word span" / "example
 * sentence span"); the contract is identical for both.
 */
function resolveWordSpans(
  text: string,
  spans: WordSpan[],
  kind: string,
  label: string,
  idByKey: Map<string, number>,
  primaryFormByVocabSlug: Map<string, string>,
): ResolvedWordSpan[] {
  // Spans are stored in text order and must not overlap: the reader composes
  // the text as [plain, span, plain, span, ...] segments.
  const sorted = [...spans].sort((left, right) => left.start - right.start);
  const Kind = kind.charAt(0).toUpperCase() + kind.slice(1);
  const resolved: ResolvedWordSpan[] = [];
  let previousEnd = 0;
  for (const [spanIndex, span] of sorted.entries()) {
    const target = `${label} -> vocabulary:${span.vocabulary_slug}`;
    const vocabId = idByKey.get(itemKey('vocabulary', span.vocabulary_slug));
    if (!vocabId) {
      throw new Error(`Unresolved ${kind}: ${target}`);
    }
    if (span.start < 0 || span.end > text.length || span.start >= span.end) {
      throw new Error(
        `Invalid ${kind} offsets: ${target} [${span.start}, ${span.end}) outside text of length ${text.length}`,
      );
    }
    if (span.start < previousEnd) {
      throw new Error(
        `Overlapping ${kind}: ${target} starts at ${span.start} before previous span ends at ${previousEnd}`,
      );
    }
    previousEnd = span.end;

    const primaryForm = primaryFormByVocabSlug.get(span.vocabulary_slug);
    const surface = text.slice(span.start, span.end);
    const claimed = span.surface_form ?? primaryForm;
    if (claimed !== undefined && surface !== claimed) {
      throw new Error(`${Kind} surface mismatch: ${target} slice "${surface}" !== "${claimed}"`);
    }
    if ((span.inflection === undefined) !== (span.surface_form === undefined)) {
      throw new Error(
        `${Kind} must carry surface_form and inflection together: ${target} has only one of them`,
      );
    }
    if (span.inflection !== undefined) {
      if (!TAUGHT_INFLECTIONS.has(span.inflection)) {
        throw new Error(
          `${Kind} inflection not taught: ${target} claims "${span.inflection}"`,
        );
      }
      const stem = primaryForm === undefined ? undefined : inflectionStem(primaryForm);
      if (stem !== undefined && (surface === primaryForm || !surface.startsWith(stem))) {
        throw new Error(
          `${Kind} is not an inflection of its item: ${target} slice "${surface}" is not a taught form of primary_form "${primaryForm}"`,
        );
      }
    }

    resolved.push({
      item_id: vocabId,
      start_offset: span.start,
      end_offset: span.end,
      inflection: span.inflection ?? null,
      sort_order: spanIndex,
    });
  }
  return resolved;
}

type ReadingPassage = {
  _meta?: SidecarMeta;
  slug: string;
  title: string;
  body: string;
  body_furigana?: string;
  english_translation?: string;
  summary_ja?: string;
  summary_en?: string;
  word_spans?: WordSpan[];
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
    .filter((name) => name.endsWith('.json') && !SIDECAR_FILE_NAMES.has(name))
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

/**
 * Item ids come from the `items` section of the id registry, so an id never
 * changes when an item is added, moved to a different level or re-sorted. The
 * (level, type, slug) order only sets the order in which new keys get ids.
 */
export function assignItemIds(
  radicals: (RadicalItem & { jlpt_level: string })[],
  kanji: (KanjiItem & { jlpt_level: string })[],
  vocabulary: (VocabItem & { jlpt_level: string })[],
  grammar: (GrammarItem & { jlpt_level: string })[],
  registry: IdRegistrySection,
  updateRegistry = false,
): { idByKey: Map<string, number>; section: IdRegistrySection } {
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

  return resolveRegistryIds(
    registry,
    'items',
    sorted.map((entry) => itemKey(entry.itemType, entry.slug)),
    updateRegistry,
  );
}

function passageKey(slug: string): string {
  return `passage:${slug}`;
}

function passageQuestionKey(passageSlug: string, questionIndex: number): string {
  return `${passageSlug}#${questionIndex}`;
}

/** `<type>:<slug|title> (<status>)` labels for content whose sidecar marks it unreviewed. */
export function collectUnreviewedContent(
  radicals: RadicalItem[],
  kanji: KanjiItem[],
  vocabulary: VocabItem[],
  grammar: GrammarItem[],
  readingsFiles: { passages: ReadingPassage[] }[],
): string[] {
  const unreviewed: string[] = [];
  const check = (label: string, meta: SidecarMeta | undefined) => {
    if (meta?.review_status && meta.review_status !== 'reviewed') {
      unreviewed.push(`${label} (${meta.review_status})`);
    }
  };

  for (const item of radicals) check(`radical:${item.slug}`, item._meta);
  for (const item of kanji) check(`kanji:${item.slug}`, item._meta);
  for (const item of vocabulary) check(`vocabulary:${item.slug}`, item._meta);
  for (const item of grammar) check(`grammar:${item.slug}`, item._meta);
  for (const file of readingsFiles) {
    for (const passage of file.passages) {
      check(`reading:${passage.slug ?? passage.title}`, passage._meta);
    }
  }
  return unreviewed;
}

export type CompileOptions = {
  /** Fail (instead of warn) when content carries a non-reviewed review_status (CI release gate). */
  failOnDraft?: boolean;
  /**
   * Give new keys ids, retire keys that left the build, and write
   * `curriculum/id-registry.json` after a successful compile. Without it, any
   * difference between the build and the registry fails the compile.
   */
  updateRegistry?: boolean;
};

export function compileCurriculum(
  outputPath: string,
  curriculumDir: string = CURRICULUM_DIR,
  options: CompileOptions = {},
): ContentCounts {
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

  const unreviewed = collectUnreviewedContent(radicals, kanji, vocabulary, grammar, readingsFiles);
  if (unreviewed.length > 0) {
    if (options.failOnDraft) {
      throw new Error(
        `Unreviewed content cannot ship (${unreviewed.length} item(s)):\n${unreviewed.join('\n')}`,
      );
    }
    for (const label of unreviewed) {
      console.warn(`warning: unreviewed content: ${label}`);
    }
  }

  const updateRegistry = options.updateRegistry ?? false;
  const storedRegistry = readIdRegistry(curriculumDir);
  if (!storedRegistry && !updateRegistry) {
    throw new Error(
      `curriculum/${ID_REGISTRY_FILE} not found. Run \`npm run compile-curriculum -- --update-registry\` to create it.`,
    );
  }
  const registry: IdRegistry = storedRegistry ?? {
    items: emptyIdRegistrySection(),
    passages: emptyIdRegistrySection(),
    passage_questions: emptyIdRegistrySection(),
  };

  const itemIds = assignItemIds(
    radicals,
    kanji,
    vocabulary,
    grammar,
    registry.items,
    updateRegistry,
  );
  const idByKey = itemIds.idByKey;
  const passages = readingsFiles.flatMap((file) => file.passages);
  const passageIds = resolveRegistryIds(
    registry.passages,
    'passages',
    passages.map((passage) => passageKey(passage.slug)),
    updateRegistry,
  );
  const questionIds = resolveRegistryIds(
    registry.passage_questions,
    'passage_questions',
    passages.flatMap((passage) =>
      (passage.questions ?? []).map((_question, index) => passageQuestionKey(passage.slug, index)),
    ),
    updateRegistry,
  );
  const primaryFormByVocabSlug = new Map(
    vocabulary.map((item) => [item.slug, item.primary_form] as const),
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
      INSERT INTO items (id, item_type, jlpt_level, slug, primary_form, furigana, meaning, word_type, reading_composition, mnemonic_text, meaning_mnemonic, reading_mnemonic, description, visual_mnemonic_url, sort_order)
      VALUES (@id, @item_type, @jlpt_level, @slug, @primary_form, @furigana, @meaning, @word_type, @reading_composition, @mnemonic_text, @meaning_mnemonic, @reading_mnemonic, @description, @visual_mnemonic_url, @sort_order)
    `);

    const insertReading = db.prepare(`
      INSERT INTO kanji_readings (item_id, reading_type, reading, sort_order)
      VALUES (@item_id, @reading_type, @reading, @sort_order)
    `);
    const insertAnswer = db.prepare(`
      INSERT INTO accepted_answers (item_id, answer_type, answer_text, is_primary)
      VALUES (@item_id, @answer_type, @answer_text, @is_primary)
    `);
    const insertExample = db.prepare(`
      INSERT INTO example_sentences (item_id, japanese, furigana, english, sort_order, reinforcement_tags)
      VALUES (@item_id, @japanese, @furigana, @english, @sort_order, @reinforcement_tags)
    `);
    const insertExampleVocab = db.prepare(`
      INSERT INTO example_sentence_vocab (sentence_id, item_id, sort_order)
      VALUES (@sentence_id, @item_id, @sort_order)
    `);
    const insertExampleSpan = db.prepare(`
      INSERT INTO example_sentence_spans (sentence_id, item_id, start_offset, end_offset, inflection, sort_order)
      VALUES (@sentence_id, @item_id, @start_offset, @end_offset, @inflection, @sort_order)
    `);
    // Example-sentence vocab links and spans can point at vocabulary items that
    // compile later than the owning kanji/grammar row, so resolve ids up front
    // and insert after every item row exists.
    const pendingExampleVocabLinks: {
      sentence_id: number;
      item_id: number;
      sort_order: number;
    }[] = [];
    const pendingExampleSpans: (ResolvedWordSpan & { sentence_id: number })[] = [];
    const insertVisuallySimilarLink = db.prepare(`
      INSERT INTO visually_similar_links (item_id, similar_item_id, sort_order)
      VALUES (@item_id, @similar_item_id, @sort_order)
    `);
    // Look-alikes can point at items later in the compile order (or the other
    // item type), so links are resolved up front and inserted after all item
    // rows exist. Each ref is "<kind>:<slug>", the same form as an item key.
    const pendingSimilarLinks: {
      item_id: number;
      similar_item_id: number;
      sort_order: number;
    }[] = [];
    const collectSimilarLinks = (
      itemId: number,
      label: string,
      refs: string[] | undefined,
    ) => {
      for (const [index, ref] of (refs ?? []).entries()) {
        const similarId = idByKey.get(ref);
        if (!similarId) {
          throw new Error(`Unresolved visually similar link: ${label} -> ${ref}`);
        }
        pendingSimilarLinks.push({
          item_id: itemId,
          similar_item_id: similarId,
          sort_order: index,
        });
      }
    };

    const insertExamples = (itemId: number, sentences: ExampleSentence[], ownerLabel: string) => {
      for (const [index, sentence] of sentences.entries()) {
        const result = insertExample.run({
          item_id: itemId,
          japanese: sentence.japanese,
          furigana: sentence.furigana ?? null,
          english: sentence.english,
          sort_order: sentence.sort_order ?? index,
          reinforcement_tags: sentence.reinforcement_tags
            ? JSON.stringify(sentence.reinforcement_tags)
            : null,
        });
        const sentenceId = Number(result.lastInsertRowid);
        for (const [slugIndex, vocabSlug] of (sentence.vocabulary_slugs ?? []).entries()) {
          const vocabId = idByKey.get(itemKey('vocabulary', vocabSlug));
          if (!vocabId) {
            throw new Error(
              `Unresolved example vocabulary link: ${ownerLabel} example[${index}] -> vocabulary:${vocabSlug}`,
            );
          }
          pendingExampleVocabLinks.push({
            sentence_id: sentenceId,
            item_id: vocabId,
            sort_order: slugIndex,
          });
        }
        for (const span of resolveWordSpans(
          sentence.japanese,
          sentence.word_spans ?? [],
          'example sentence span',
          `${ownerLabel} example[${index}]`,
          idByKey,
          primaryFormByVocabSlug,
        )) {
          pendingExampleSpans.push({ ...span, sentence_id: sentenceId });
        }
      }
    };

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
        word_type: null,
        reading_composition: null,
        mnemonic_text: radical.mnemonic_text ?? null,
        meaning_mnemonic: null,
        reading_mnemonic: null,
        description: radical.description ?? null,
        // Skeleton-level radicals have no art yet; the app falls back to
        // mnemonic text when the ref is absent (utils/radicalImages.ts).
        visual_mnemonic_url: radical.visual_mnemonic_url ?? null,
        sort_order: radical.sort_order ?? 0,
      });

      collectSimilarLinks(id, `radical:${radical.slug}`, radical.visually_similar_slugs);

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
        word_type: null,
        reading_composition: null,
        mnemonic_text: kanjiItem.mnemonic_text ?? null,
        meaning_mnemonic: kanjiItem.meaning_mnemonic ?? null,
        reading_mnemonic: kanjiItem.reading_mnemonic ?? null,
        description: kanjiItem.description ?? null,
        // Mnemonic art stops at the radical layer; kanji use text mnemonics only.
        visual_mnemonic_url: null,
        sort_order: kanjiItem.sort_order ?? 0,
      });

      collectSimilarLinks(id, `kanji:${kanjiItem.slug}`, kanjiItem.visually_similar_slugs);

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

      insertExamples(id, kanjiItem.example_sentences ?? [], `kanji:${kanjiItem.slug}`);
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
        word_type: vocab.word_type ?? null,
        reading_composition: vocab.reading_composition ?? null,
        mnemonic_text: vocab.mnemonic_text ?? null,
        meaning_mnemonic: vocab.meaning_mnemonic ?? null,
        reading_mnemonic: vocab.reading_mnemonic ?? null,
        description: vocab.description ?? null,
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

      insertExamples(id, vocab.example_sentences ?? [], `vocabulary:${vocab.slug}`);
    }

    const insertGrammarRule = db.prepare(`
      INSERT INTO grammar_rules (item_id, structure, conjugation_rules, accepted_forms, family, explanation_markdown, caution_notes, uses)
      VALUES (@item_id, @structure, @conjugation_rules, @accepted_forms, @family, @explanation_markdown, @caution_notes, @uses)
    `);
    const insertGrammarRelatedLink = db.prepare(`
      INSERT INTO grammar_related_links (grammar_item_id, related_item_id, sort_order)
      VALUES (@grammar_item_id, @related_item_id, @sort_order)
    `);
    const insertClozeVariant = db.prepare(`
      INSERT INTO grammar_cloze_variants (item_id, jp_cloze, jp_cloze_furigana, english, answer, nudge, sort_order)
      VALUES (@item_id, @jp_cloze, @jp_cloze_furigana, @english, @answer, @nudge, @sort_order)
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
        word_type: null,
        reading_composition: null,
        mnemonic_text: null,
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
        uses: grammarItem.uses ? JSON.stringify(grammarItem.uses) : null,
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
          jp_cloze_furigana: variant.jp_cloze_furigana ?? null,
          english: variant.english,
          answer: variant.answer,
          nudge: variant.nudge,
          sort_order: variant.sort_order ?? index,
        });
      }

      insertExamples(id, grammarItem.example_sentences ?? [], `grammar:${grammarItem.slug}`);

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

    for (const link of pendingSimilarLinks) {
      insertVisuallySimilarLink.run(link);
    }

    for (const link of pendingExampleVocabLinks) {
      insertExampleVocab.run(link);
    }

    for (const span of pendingExampleSpans) {
      insertExampleSpan.run(span);
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
      INSERT INTO reading_passages (id, jlpt_level, title, body, body_furigana, english_translation, summary_ja, summary_en, word_count, sort_order)
      VALUES (@id, @jlpt_level, @title, @body, @body_furigana, @english_translation, @summary_ja, @summary_en, @word_count, @sort_order)
    `);
    const insertPassageWordSpan = db.prepare(`
      INSERT INTO passage_word_spans (passage_id, vocabulary_item_id, start_offset, end_offset, inflection, sort_order)
      VALUES (@passage_id, @vocabulary_item_id, @start_offset, @end_offset, @inflection, @sort_order)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO passage_questions (id, passage_id, prompt, prompt_furigana, accepted_answers, sort_order)
      VALUES (@id, @passage_id, @prompt, @prompt_furigana, @accepted_answers, @sort_order)
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
        const passageId = passageIds.idByKey.get(passageKey(passage.slug))!;
        insertPassage.run({
          id: passageId,
          jlpt_level: readingsFile.jlpt_level,
          title: passage.title,
          body: passage.body,
          body_furigana: passage.body_furigana ?? null,
          english_translation: passage.english_translation ?? null,
          summary_ja: passage.summary_ja ?? null,
          summary_en: passage.summary_en ?? null,
          word_count: passage.word_count ?? null,
          sort_order: passage.sort_order ?? index,
        });
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

        const resolvedSpans = resolveWordSpans(
          passage.body,
          passage.word_spans ?? [],
          'passage word span',
          passageLabel,
          idByKey,
          primaryFormByVocabSlug,
        );
        for (const span of resolvedSpans) {
          insertPassageWordSpan.run({
            passage_id: passageId,
            vocabulary_item_id: span.item_id,
            start_offset: span.start_offset,
            end_offset: span.end_offset,
            inflection: span.inflection,
            sort_order: span.sort_order,
          });
        }

        for (const [qIndex, question] of (passage.questions ?? []).entries()) {
          insertQuestion.run({
            id: questionIds.idByKey.get(passageQuestionKey(passage.slug, qIndex))!,
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
      version: String(metadata.version),
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

  if (updateRegistry) {
    writeIdRegistry(curriculumDir, {
      items: itemIds.section,
      passages: passageIds.section,
      passage_questions: questionIds.section,
    });
  }

  // Sidecar the app reads at launch to tell whether the bundled seed is newer
  // than the curriculum already installed on the device.
  fs.writeFileSync(
    path.join(path.dirname(outputPath), SEED_INFO_FILE),
    `${JSON.stringify({ version: metadata.version }, null, 2)}\n`,
  );

  return {
    radicals: radicals.length,
    kanji: kanji.length,
    vocabulary: vocabulary.length,
    grammar: grammar.length,
    total_items: radicals.length + kanji.length + vocabulary.length + grammar.length,
    reading_passages: passages.length,
    dependency_edges: dependenciesFile.edges.length,
  };
}

/**
 * Every compile ships a new curriculum version: raise `metadata.json` `version`
 * by 1 first, and put the file back if the compile fails. After a good compile,
 * record what was compiled in `content_counts`, so the counts cannot drift.
 */
export function compileAndRecordMetadata(
  outputPath: string,
  curriculumDir: string = CURRICULUM_DIR,
  options: CompileOptions = {},
): MetadataJson {
  const metadataPath = path.join(curriculumDir, 'metadata.json');
  const originalMetadata = fs.readFileSync(metadataPath, 'utf8');
  const metadata = JSON.parse(originalMetadata) as MetadataJson;
  metadata.version += 1;
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  try {
    metadata.content_counts = compileCurriculum(outputPath, curriculumDir, options);
  } catch (error) {
    fs.writeFileSync(metadataPath, originalMetadata);
    throw error;
  }
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

function main(): void {
  const outputPath = process.env.COMPILE_OUTPUT_PATH
    ? path.resolve(process.env.COMPILE_OUTPUT_PATH)
    : DEFAULT_OUTPUT;
  const failOnDraft =
    process.argv.includes('--fail-on-draft') || process.env.COMPILE_FAIL_ON_DRAFT === '1';
  const updateRegistry = process.argv.includes('--update-registry');

  try {
    const metadata = compileAndRecordMetadata(outputPath, undefined, {
      failOnDraft,
      updateRegistry,
    });
    console.log(`Compiled curriculum database: ${outputPath} (version ${metadata.version})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1]?.includes('compile-curriculum')) {
  main();
}
