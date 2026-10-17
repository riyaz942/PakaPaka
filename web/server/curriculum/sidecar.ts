import fs from 'node:fs';
import path from 'node:path';
import type { ContentType, ReviewStatus } from './types.js';

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
 * A content type has one sidecar of each kind for every level, keyed by slug
 * (`curriculum/<type>/mnemonics.json`, `curriculum/vocabulary/examples.json`),
 * and a grammar point has one lesson file (`curriculum/grammar/lessons/<slug>.md`).
 * No sidecar path depends on the level.
 */

type SidecarKind = 'mnemonics' | 'examples';

const CONTENT_DIR: Record<ContentType, string> = {
  radical: 'radicals',
  kanji: 'kanji',
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  reading: 'readings',
};

/** Item fields generate.py inlines from the mnemonic sidecar, per type. */
const MNEMONIC_FIELDS: Record<ContentType, readonly string[]> = {
  radical: ['mnemonic_text', 'description'],
  kanji: ['meaning_mnemonic', 'reading_mnemonic', 'description'],
  vocabulary: ['meaning_mnemonic', 'reading_mnemonic', 'description'],
  grammar: ['mnemonic_text'],
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
  radical: 'curriculum/_build/{n5,n4}_radicals.py (or skeleton.json for KANJIDIC2-derived radicals)',
  kanji: 'curriculum/_build/{n5,n4}_kanji.py (or skeleton.json for KANJIDIC2-derived kanji)',
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

function sidecarPath(repoRoot: string, type: ContentType, kind: SidecarKind): string {
  return path.join(repoRoot, 'curriculum', CONTENT_DIR[type], `${kind}.json`);
}

function lessonPath(repoRoot: string, slug: string): string {
  return path.join(repoRoot, 'curriculum', 'grammar', 'lessons', `${slug}.md`);
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

  const touchedMnemonicFields = changed.filter((key) => mnemonicFields.includes(key));
  if (touchedMnemonicFields.length > 0) {
    const filePath = sidecarPath(repoRoot, type, 'mnemonics');
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
    const filePath = sidecarPath(repoRoot, type, 'examples');
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

/** Rewrites `review_status:` in a grammar lesson's YAML frontmatter; 'none' drops the line. */
function persistGrammarReviewStatus(
  repoRoot: string,
  slug: string,
  reviewStatus: ReviewStatus,
): PersistResult {
  const filePath = lessonPath(repoRoot, slug);
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      errors: [
        `${slug} has no lesson at curriculum/grammar/lessons/${slug}.md, ` +
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
  let updated: string;
  if (reviewStatus === 'none') {
    updated = frontmatter
      .split('\n')
      .filter((l) => !/^review_status:/.test(l))
      .join('\n');
  } else if (/^review_status:.*$/m.test(frontmatter)) {
    updated = frontmatter.replace(/^review_status:.*$/m, line);
  } else {
    updated = `${frontmatter}\n${line}`;
  }

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `---\n${updated}\n---\n${source.slice(match[0].length)}`, 'utf8');
  fs.renameSync(tmpPath, filePath);
  return { ok: true };
}

/** generate.py's `_merge_sidecar_meta` order: the least reviewed status wins. */
const STATUS_RANK: Record<Exclude<ReviewStatus, 'none'>, number> = {
  flagged_for_rewrite: 0,
  draft: 1,
  reviewed: 2,
};

/**
 * The status generate.py writes on a grammar row: the least reviewed of the
 * lesson's and the mnemonic's. 'none' (and a point with no mnemonic) counts as
 * absent, the same as a missing `review_status` key there.
 */
export function mergeGrammarReviewStatus(
  lesson: ReviewStatus,
  mnemonic: ReviewStatus | null,
): ReviewStatus {
  const present = [lesson, mnemonic].filter(
    (s): s is Exclude<ReviewStatus, 'none'> => s !== null && s !== 'none',
  );
  if (present.length === 0) return 'none';
  return present.reduce((a, b) => (STATUS_RANK[b] < STATUS_RANK[a] ? b : a));
}

/** The grammar mnemonic sidecar entry's own status; null when the point has no entry. */
export function readGrammarMnemonicStatus(repoRoot: string, slug: string): ReviewStatus | null {
  const file = readJsonFile<SidecarFile>(sidecarPath(repoRoot, 'grammar', 'mnemonics'), {});
  const entry = file[slug];
  if (!entry) return null;
  const status = (entry._meta as Record<string, unknown> | undefined)?.review_status;
  return typeof status === 'string' ? (status as ReviewStatus) : 'none';
}

/** `review_status:` from a grammar lesson's frontmatter; 'none' when it has none. */
export function readGrammarLessonStatus(repoRoot: string, slug: string): ReviewStatus {
  const filePath = lessonPath(repoRoot, slug);
  if (!fs.existsSync(filePath)) return 'none';
  const match = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(filePath, 'utf8'));
  const line = match ? /^review_status:\s*(\S+)\s*$/m.exec(match[1]) : null;
  return line ? (line[1] as ReviewStatus) : 'none';
}

/**
 * Writes a grammar mnemonic's own review status to curriculum/grammar/mnemonics.json.
 * The lesson frontmatter is never touched, so reviewing a mnemonic cannot change
 * a reviewed lesson. A point with no mnemonic entry has nothing to review.
 */
export function persistGrammarMnemonicReviewStatus(
  repoRoot: string,
  slug: string,
  reviewStatus: ReviewStatus,
): PersistResult {
  const filePath = sidecarPath(repoRoot, 'grammar', 'mnemonics');
  const file = readJsonFile<SidecarFile>(filePath, {});
  if (!file[slug]) {
    return {
      ok: false,
      errors: [`${slug} has no entry in curriculum/grammar/mnemonics.json — generate its mnemonic first.`],
    };
  }
  const entry = { ...file[slug] };
  const meta = { ...((entry._meta as Record<string, unknown>) ?? {}) };
  if (reviewStatus === 'none') {
    delete meta.review_status;
  } else {
    meta.review_status = reviewStatus;
  }
  if (Object.keys(meta).length > 0) {
    entry._meta = meta;
  } else {
    delete entry._meta;
  }
  file[slug] = entry;
  writeJsonFile(filePath, file);
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
  slug: string,
): string[] {
  if (type === 'reading') {
    return [
      `${slug}: reading passages carry no sidecar — a review status set here would ` +
        `be lost on the next generate.py run. Edit ${AUTHORED_IN.reading} instead.`,
    ];
  }
  if (type === 'grammar') {
    return fs.existsSync(lessonPath(repoRoot, slug))
      ? []
      : [
          `${slug}: no lesson at curriculum/grammar/lessons/${slug}.md, ` +
            "which is where a grammar point's review status is stored.",
        ];
  }
  return [];
}

/**
 * Writes a review-status flip to the sidecar(s) generate.py reads it back from.
 * A vocabulary item can carry both a mnemonic and an examples sidecar,
 * and generate.py keeps the least-reviewed of the two, so a flip has to reach
 * every sidecar that holds the item. 'none' clears the status instead.
 */
export function persistReviewStatus(
  repoRoot: string,
  type: ContentType,
  slug: string,
  reviewStatus: ReviewStatus,
): PersistResult {
  const blocked = checkReviewStatusTarget(repoRoot, type, slug);
  if (blocked.length > 0) {
    return { ok: false, errors: blocked };
  }
  if (type === 'grammar') {
    return persistGrammarReviewStatus(repoRoot, slug, reviewStatus);
  }

  const kinds: SidecarKind[] = HAS_EXAMPLES_SIDECAR[type]
    ? ['mnemonics', 'examples']
    : ['mnemonics'];

  const files = kinds.map((kind) => {
    const filePath = sidecarPath(repoRoot, type, kind);
    return { filePath, file: readJsonFile<SidecarFile>(filePath, {}) };
  });

  // An item with no sidecar entry at all (its prose comes from the dataset, or
  // it is a skeleton) still gets one: an entry carrying only `_meta` is how
  // generate.py records a review with nothing generated to attach it to.
  const targets = files.filter(({ file }) => file[slug] !== undefined);
  if (targets.length === 0 && reviewStatus !== 'none') {
    targets.push(files[0]);
  }

  for (const { filePath, file } of targets) {
    const entry = { ...(file[slug] ?? {}) };
    const meta = { ...((entry._meta as Record<string, unknown>) ?? {}) };
    if (reviewStatus === 'none') {
      delete meta.review_status;
    } else {
      meta.review_status = reviewStatus;
    }
    if (Object.keys(meta).length > 0) {
      entry._meta = meta;
    } else {
      delete entry._meta;
    }
    file[slug] = entry;
    writeJsonFile(filePath, file);
  }

  return { ok: true };
}
