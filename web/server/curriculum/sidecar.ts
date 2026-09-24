import fs from 'node:fs';
import path from 'node:path';
import type { ContentType, JlptLevel, ReviewStatus } from './types.js';

/**
 * Durable write-back for Studio edits.
 *
 * `curriculum/{radicals,kanji,vocabulary,grammar,readings}/{level}.json` is
 * generated output: `curriculum/_build/generate.py` rebuilds it from the Python
 * datasets plus the sidecars, so anything written only there is destroyed by the
 * next generate run. This module writes the edit to the input generate.py reads
 * back, and reports the fields that have no such input so the API can refuse
 * them instead of accepting an edit that will not survive.
 *
 * Sidecars for radicals and kanji are keyed by *source dataset*, not by the
 * level the item is taught at — a band mixes sources (see
 * generate_content/generate_mnemonics.py). Vocabulary is unbanded, so its
 * sidecar is keyed by level.
 */

type SidecarKind = 'mnemonics' | 'examples';

const CONTENT_DIR: Record<ContentType, string> = {
  radical: 'radicals',
  kanji: 'kanji',
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  reading: 'readings',
};

/** Kinds whose sidecar name is a source dataset resolved through bands.json. */
const BANDED: ReadonlySet<ContentType> = new Set<ContentType>(['radical', 'kanji']);

/** Item fields generate.py inlines from the mnemonic sidecar, per type. */
const MNEMONIC_FIELDS: Record<ContentType, readonly string[]> = {
  radical: ['mnemonic_text', 'description'],
  kanji: ['meaning_mnemonic', 'reading_mnemonic', 'description'],
  vocabulary: ['meaning_mnemonic', 'reading_mnemonic', 'description'],
  grammar: [],
  reading: [],
};

const HAS_EXAMPLES_SIDECAR: Record<ContentType, boolean> = {
  radical: false,
  kanji: false,
  vocabulary: true,
  grammar: false,
  reading: false,
};

/**
 * The only example-sentence keys a sidecar stores. `furigana`, `sort_order` and
 * `word_spans` are derived by generate.py (tokenizer + spans.py) and an edit to
 * them cannot be written back.
 */
const EXAMPLE_SIDECAR_KEYS = ['japanese', 'english', 'vocabulary_slugs'] as const;

/** Where a field that has no sidecar is actually authored. */
const AUTHORED_IN: Record<ContentType, string> = {
  radical: 'curriculum/_build/{n5,n4}_radicals.py (or skeleton.json for k-corpus radicals)',
  kanji: 'curriculum/_build/{n5,n4}_kanji.py (or skeleton.json for k-corpus kanji)',
  vocabulary: 'curriculum/_build/{n5,n4}_vocab.py (or vocab_skeleton.json)',
  grammar: 'curriculum/_build/{n5,n4}_grammar.py and curriculum/grammar/lessons/',
  reading: 'curriculum/_build/{n5,n4}_readings.py',
};

export type PersistResult = { ok: true } | { ok: false; errors: string[] };

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/** Same shape python's json.dump(ensure_ascii=False, indent=2) writes. */
function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/** The sidecar name for this item: its source dataset, or its level. */
function sidecarName(repoRoot: string, type: ContentType, level: JlptLevel, slug: string): string {
  if (!BANDED.has(type)) {
    return level.toLowerCase();
  }
  const bandsPath = path.join(repoRoot, 'curriculum', '_build', 'bands.json');
  const bands = readJsonFile<Record<string, Record<string, { source?: string }>>>(bandsPath, {});
  const group = type === 'radical' ? bands.radicals : bands.kanji;
  const source = group?.[slug]?.source;
  if (!source) {
    throw new Error(
      `${type} "${slug}" has no entry in curriculum/_build/bands.json — ` +
        'run reports/kanji_bands.py before editing it.',
    );
  }
  return source;
}

function sidecarPath(
  repoRoot: string,
  type: ContentType,
  kind: SidecarKind,
  name: string,
): string {
  return path.join(repoRoot, 'curriculum', CONTENT_DIR[type], kind, `${name}.json`);
}

type SidecarFile = Record<string, Record<string, unknown>>;

/** The example-sentence rows as the sidecar stores them (derived keys dropped). */
function projectExamples(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const source = (row ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of EXAMPLE_SIDECAR_KEYS) {
      const cell = source[key];
      if (cell === undefined || cell === null) continue;
      if (Array.isArray(cell) && cell.length === 0) continue;
      out[key] = cell;
    }
    return out;
  });
}

function changedKeys(
  current: Record<string, unknown>,
  updated: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(current), ...Object.keys(updated)]);
  return [...keys].filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(updated[key]),
  );
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Writes the sidecar-backed part of a Studio edit, and reports every changed
 * field that has no sidecar to write it to. Errors are returned rather than
 * thrown so the caller can refuse the whole save before touching any file.
 */
export function persistItemEdit(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
  currentRaw: Record<string, unknown>,
  updatedRaw: Record<string, unknown>,
): PersistResult {
  const changed = changedKeys(currentRaw, updatedRaw);
  if (changed.length === 0) {
    return { ok: true };
  }

  const mnemonicFields = MNEMONIC_FIELDS[type];
  const hasExamples = HAS_EXAMPLES_SIDECAR[type];
  const errors: string[] = [];

  const unpersistable = changed.filter(
    (key) =>
      !mnemonicFields.includes(key) && !(hasExamples && key === 'example_sentences'),
  );
  for (const key of unpersistable) {
    if (key === '_meta') {
      errors.push('_meta: use the review-status control, which writes the sidecar.');
      continue;
    }
    errors.push(
      `${key}: generated by curriculum/_build/generate.py — no sidecar to write it to. ` +
        `Edit ${AUTHORED_IN[type]} instead.`,
    );
  }

  const examplesChanged = hasExamples && changed.includes('example_sentences');
  const nextExamples = examplesChanged ? projectExamples(updatedRaw.example_sentences) : null;
  if (
    examplesChanged &&
    JSON.stringify(nextExamples) === JSON.stringify(projectExamples(currentRaw.example_sentences))
  ) {
    errors.push(
      'example_sentences: only furigana / sort_order / word_spans changed, and ' +
        'generate.py derives all three — edit the Japanese text instead.',
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const name = sidecarName(repoRoot, type, level, slug);

  const touchedMnemonicFields = changed.filter((key) => mnemonicFields.includes(key));
  if (touchedMnemonicFields.length > 0) {
    const filePath = sidecarPath(repoRoot, type, 'mnemonics', name);
    const file = readJsonFile<SidecarFile>(filePath, {});
    const entry = { ...(file[slug] ?? {}) };
    for (const key of touchedMnemonicFields) {
      const value = updatedRaw[key];
      // generate.py inlines a sidecar field only when it is truthy, so an
      // emptied field is stored as absent — that is what regeneration produces.
      if (isEmptyValue(value)) {
        delete entry[key];
      } else {
        entry[key] = value;
      }
    }
    file[slug] = entry;
    writeJsonFile(filePath, file);
  }

  if (nextExamples) {
    const filePath = sidecarPath(repoRoot, type, 'examples', name);
    const file = readJsonFile<SidecarFile>(filePath, {});
    const entry = { ...(file[slug] ?? {}) };
    if (nextExamples.length === 0) {
      delete entry.example_sentences;
    } else {
      entry.example_sentences = nextExamples;
    }
    file[slug] = entry;
    writeJsonFile(filePath, file);
  }

  return { ok: true };
}

/** Rewrites `review_status:` in a grammar lesson's YAML frontmatter. */
function persistGrammarReviewStatus(
  repoRoot: string,
  level: JlptLevel,
  slug: string,
  reviewStatus: Exclude<ReviewStatus, 'none'>,
): PersistResult {
  const filePath = path.join(
    repoRoot,
    'curriculum',
    'grammar',
    'lessons',
    level.toLowerCase(),
    `${slug}.md`,
  );
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      errors: [
        `${slug} has no lesson at curriculum/grammar/lessons/${level.toLowerCase()}/${slug}.md, ` +
          'which is where a grammar point\'s review status is stored.',
      ],
    };
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) {
    return { ok: false, errors: [`${slug}.md has no frontmatter block to write into.`] };
  }

  const frontmatter = match[1];
  const line = `review_status: ${reviewStatus}`;
  const updated = /^review_status:.*$/m.test(frontmatter)
    ? frontmatter.replace(/^review_status:.*$/m, line)
    : `${frontmatter}\n${line}`;

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `---\n${updated}\n---\n${source.slice(match[0].length)}`, 'utf8');
  fs.renameSync(tmpPath, filePath);
  return { ok: true };
}

/**
 * Errors that would stop a review-status flip from being persisted, without
 * writing anything — the bulk path validates the whole selection first so one
 * unwritable item cannot leave the rest half-applied.
 */
export function checkReviewStatusTarget(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
): string[] {
  if (type === 'reading') {
    return [
      `${slug}: reading passages carry no sidecar — a review status set here would ` +
        `be lost on the next generate.py run. Edit ${AUTHORED_IN.reading} instead.`,
    ];
  }
  if (type === 'grammar') {
    const lesson = path.join(
      repoRoot, 'curriculum', 'grammar', 'lessons', level.toLowerCase(), `${slug}.md`,
    );
    return fs.existsSync(lesson)
      ? []
      : [
          `${slug}: no lesson at curriculum/grammar/lessons/${level.toLowerCase()}/${slug}.md, ` +
            "which is where a grammar point's review status is stored.",
        ];
  }
  try {
    sidecarName(repoRoot, type, level, slug);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/**
 * Writes a review-status flip to the sidecar(s) generate.py reads it back from.
 * A vocabulary item can carry both a mnemonic and an examples sidecar,
 * and generate.py keeps the least-reviewed of the two, so a flip has to reach
 * every sidecar that holds the item.
 */
export function persistReviewStatus(
  repoRoot: string,
  type: ContentType,
  level: JlptLevel,
  slug: string,
  reviewStatus: Exclude<ReviewStatus, 'none'>,
): PersistResult {
  const blocked = checkReviewStatusTarget(repoRoot, type, level, slug);
  if (blocked.length > 0) {
    return { ok: false, errors: blocked };
  }
  if (type === 'grammar') {
    return persistGrammarReviewStatus(repoRoot, level, slug, reviewStatus);
  }

  const name = sidecarName(repoRoot, type, level, slug);
  const kinds: SidecarKind[] = HAS_EXAMPLES_SIDECAR[type]
    ? ['mnemonics', 'examples']
    : ['mnemonics'];

  const files = kinds.map((kind) => {
    const filePath = sidecarPath(repoRoot, type, kind, name);
    return { filePath, file: readJsonFile<SidecarFile>(filePath, {}) };
  });

  // An item with no sidecar entry at all (its prose comes from the dataset, or
  // it is a skeleton) still gets one: an entry carrying only `_meta` is how
  // generate.py records a review with nothing generated to attach it to.
  const targets = files.filter(({ file }) => file[slug] !== undefined);
  if (targets.length === 0) {
    targets.push(files[0]);
  }

  for (const { filePath, file } of targets) {
    const entry = { ...(file[slug] ?? {}) };
    const meta = { ...((entry._meta as Record<string, unknown>) ?? {}) };
    meta.review_status = reviewStatus;
    entry._meta = meta;
    file[slug] = entry;
    writeJsonFile(filePath, file);
  }

  return { ok: true };
}
