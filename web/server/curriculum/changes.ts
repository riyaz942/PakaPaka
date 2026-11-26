import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { itemKey, type ContentType } from './types.js';

/**
 * Which items changed since a git revision. The corpus has no timestamps, so
 * "recent" is found by comparing every file an item is built from — its row
 * in `<kind>/items.json` plus its slug-keyed sidecars — with the same file at
 * the revision. The working tree is the "after" side, so uncommitted edits
 * count. Grammar lessons (`grammar/lessons/*.md`) are not compared.
 */

type Shape = 'items' | 'passages' | 'bySlug';

const SOURCES: { type: ContentType; file: string; shape: Shape }[] = [
  { type: 'radical', file: 'curriculum/radicals/items.json', shape: 'items' },
  { type: 'radical', file: 'curriculum/radicals/mnemonics.json', shape: 'bySlug' },
  { type: 'kanji', file: 'curriculum/kanji/items.json', shape: 'items' },
  { type: 'kanji', file: 'curriculum/kanji/mnemonics.json', shape: 'bySlug' },
  { type: 'vocabulary', file: 'curriculum/vocabulary/items.json', shape: 'items' },
  { type: 'vocabulary', file: 'curriculum/vocabulary/mnemonics.json', shape: 'bySlug' },
  { type: 'vocabulary', file: 'curriculum/vocabulary/examples.json', shape: 'bySlug' },
  { type: 'grammar', file: 'curriculum/grammar/items.json', shape: 'items' },
  { type: 'grammar', file: 'curriculum/grammar/mnemonics.json', shape: 'bySlug' },
  { type: 'grammar', file: 'curriculum/grammar/pool.json', shape: 'bySlug' },
  { type: 'reading', file: 'curriculum/readings/items.json', shape: 'passages' },
];

// Large files (vocabulary/items.json is ~10 MB) come back through git show.
const MAX_BUFFER = 256 * 1024 * 1024;

/** slug -> serialized entry, one map per source file. */
type Entries = Map<string, string>;

function toEntries(data: unknown, shape: Shape): Entries {
  const out: Entries = new Map();
  if (typeof data !== 'object' || data === null) return out;
  if (shape === 'bySlug') {
    for (const [slug, value] of Object.entries(data)) {
      if (!slug.startsWith('_')) out.set(slug, JSON.stringify(value));
    }
    return out;
  }
  const rows = (data as Record<string, unknown>)[shape];
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const slug = (row as { slug?: unknown }).slug;
    if (typeof slug === 'string') out.set(slug, JSON.stringify(row));
  }
  return out;
}

/** Slugs that are new in `after` or whose entry differs. Removed slugs are not listed. */
export function changedSlugs(before: Entries, after: Entries): Set<string> {
  const changed = new Set<string>();
  for (const [slug, value] of after) {
    if (before.get(slug) !== value) changed.add(slug);
  }
  return changed;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: MAX_BUFFER });
}

// A revision never changes, so its parsed files are kept for the session.
const revCache = new Map<string, Entries>();

function entriesAtRev(repoRoot: string, rev: string, file: string, shape: Shape): Entries {
  const key = `${repoRoot}|${rev}|${file}`;
  const cached = revCache.get(key);
  if (cached) return cached;
  // A file that did not exist at the revision: every slug in it is new.
  const exists = git(repoRoot, ['ls-tree', '--name-only', rev, '--', file]).trim() !== '';
  const entries = exists ? toEntries(JSON.parse(git(repoRoot, ['show', `${rev}:${file}`])), shape) : new Map();
  revCache.set(key, entries);
  return entries;
}

function entriesOnDisk(repoRoot: string, file: string, shape: Shape): Entries {
  const fullPath = path.join(repoRoot, file);
  if (!fs.existsSync(fullPath)) return new Map();
  return toEntries(JSON.parse(fs.readFileSync(fullPath, 'utf8')), shape);
}

/** `itemKey(type, slug)` of every item whose content differs from `rev`. */
export function changedItemKeys(repoRoot: string, rev: string): Set<string> {
  const keys = new Set<string>();
  for (const { type, file, shape } of SOURCES) {
    const before = entriesAtRev(repoRoot, rev, file, shape);
    const after = entriesOnDisk(repoRoot, file, shape);
    for (const slug of changedSlugs(before, after)) keys.add(itemKey(type, slug));
  }
  return keys;
}

export type ChangeBase = {
  days: number;
  rev: string;
  /** Commit date of `rev`, ISO 8601. */
  date: string;
  subject: string;
};

/**
 * The last commit made before `days` ago, or null when the history is younger
 * than that (then nothing is marked changed, and the page says why).
 */
export function changeBase(repoRoot: string, days: number): ChangeBase | null {
  const rev = git(repoRoot, ['rev-list', '-1', `--before=${days} days ago`, 'HEAD']).trim();
  if (!rev) return null;
  const [date, subject] = git(repoRoot, ['show', '-s', '--format=%cI%n%s', rev]).trim().split('\n');
  return { days, rev, date, subject };
}
