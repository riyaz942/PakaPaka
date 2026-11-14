/**
 * One-off (level-agnostic plan, phase 5): rewrites the item slugs in an app
 * backup (`pakapaka-backup-*.json.gz`) through `curriculum/_build/slug-renames.json`,
 * so a restore on the new curriculum finds every item. When two old slugs map
 * to one new slug (a grammar merge), each table keeps one row for the item.
 *
 * It checks the result against a compiled curriculum.db and writes
 * `<name>-migrated.json.gz` next to the input only when every ref matches.
 * It never overwrites a file.
 *
 * Usage: npx tsx scripts/rewrite-backup-slugs.ts <backup.json.gz> [--dry-run] [--db path/to/curriculum.db]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';

const REPO_ROOT = process.cwd();
const DEFAULT_RENAMES = path.join(REPO_ROOT, 'curriculum', '_build', 'slug-renames.json');
const DEFAULT_DB = path.join(REPO_ROOT, 'mobile', 'assets', 'curriculum-seed', 'curriculum.db');

/** Mirrors `ItemRef` in `mobile/src/core/backup/backup.types.ts`. */
export type ItemRef = { itemType: string; slug: string };

type Row = Record<string, unknown>;
type ItemRow = Row & { item: ItemRef };

export type BackupBundle = Row & { data: Record<string, Row[]> };

export type TableCounts = Record<string, { before: number; after: number }>;

/** Old ref key → new ref key, both `"<kind>:<slug>"`. */
export type SlugRenames = Record<string, string>;

function refKey(ref: ItemRef): string {
  return `${ref.itemType}:${ref.slug}`;
}

function renameRef(ref: ItemRef, renames: SlugRenames): ItemRef {
  const renamed = renames[refKey(ref)];
  if (!renamed) return ref;
  const split = renamed.indexOf(':');
  return { itemType: renamed.slice(0, split), slug: renamed.slice(split + 1) };
}

const STATUS_RANK: Record<string, number> = { not_started: 0, in_progress: 1, known: 2 };

/** ISO timestamps compare as text; null is earlier than any time. */
function later(a: unknown, b: unknown): boolean {
  return String(a ?? '') > String(b ?? '');
}

/** Returns the row to keep when `kept` and `next` are the same item. */
type MergeRule = (kept: ItemRow, next: ItemRow) => ItemRow;

const keepLaterUpdate: MergeRule = (kept, next) => (later(next.updatedAt, kept.updatedAt) ? next : kept);

const MERGE_RULES: Record<string, MergeRule> = {
  itemStudyStatus: (kept, next) => {
    const diff = STATUS_RANK[String(next.status)] - STATUS_RANK[String(kept.status)];
    if (diff !== 0) return diff > 0 ? next : kept;
    return keepLaterUpdate(kept, next);
  },
  srsStates: (kept, next) => {
    if (next.lastReviewedAt !== kept.lastReviewedAt) {
      return later(next.lastReviewedAt, kept.lastReviewedAt) ? next : kept;
    }
    return Number(next.stability) > Number(kept.stability) ? next : kept;
  },
  weaknessStats: (kept, next) => {
    const lastError = later(next.lastErrorAt, kept.lastErrorAt) ? next : kept;
    return {
      ...kept,
      correctCount: Number(kept.correctCount) + Number(next.correctCount),
      incorrectCount: Number(kept.incorrectCount) + Number(next.incorrectCount),
      typoCount: Number(kept.typoCount) + Number(next.typoCount),
      lastErrorAt: lastError.lastErrorAt,
      lastErrorType: lastError.lastErrorType,
      updatedAt: later(next.updatedAt, kept.updatedAt) ? next.updatedAt : kept.updatedAt,
    };
  },
  relatedItemBoosts: (kept, next) => (Number(next.boost) > Number(kept.boost) ? next : kept),
  personalMnemonics: keepLaterUpdate,
  furiganaOverrides: keepLaterUpdate,
};

/** The tables whose rows store an `item` ref (see `collectItemRefs` in `restoreBackup.ts`). */
const ITEM_TABLES = new Set([
  'itemStudyStatus',
  'srsStates',
  'personalMnemonics',
  'relatedItemBoosts',
  'weaknessStats',
  'userSynonyms',
  'furiganaOverrides',
]);

/** `userSynonyms` keeps both rows of a merge; only its primary key must be unique. */
function synonymKey(row: ItemRow): string {
  return `${refKey(row.item)}|${String(row.answerType)}|${String(row.answerText)}`;
}

function mergeRows(table: string, rows: ItemRow[]): ItemRow[] {
  const keyOf = table === 'userSynonyms' ? synonymKey : (row: ItemRow) => refKey(row.item);
  const rule: MergeRule = MERGE_RULES[table] ?? ((kept) => kept);
  const kept = new Map<string, ItemRow>();
  for (const row of rows) {
    const key = keyOf(row);
    const existing = kept.get(key);
    kept.set(key, existing ? rule(existing, row) : row);
  }
  return Array.from(kept.values());
}

function rewriteSummaryJson(raw: unknown, renames: SlugRenames): unknown {
  if (typeof raw !== 'string' || raw === '') return raw;
  const parsed = JSON.parse(raw) as Row;
  if (!Array.isArray(parsed.wordsMet)) return raw;
  const wordsMet = (parsed.wordsMet as Row[]).map((word) =>
    word.item ? { ...word, item: renameRef(word.item as ItemRef, renames) } : word,
  );
  return JSON.stringify({ ...parsed, wordsMet });
}

function rewriteAiSession(session: Row, renames: SlugRenames): Row {
  const topicItems = new Map<string, ItemRef>();
  for (const ref of (session.topicItems as ItemRef[] | undefined) ?? []) {
    const renamed = renameRef(ref, renames);
    topicItems.set(refKey(renamed), renamed);
  }
  return {
    ...session,
    topicItem: session.topicItem ? renameRef(session.topicItem as ItemRef, renames) : null,
    topicItems: Array.from(topicItems.values()),
    summaryJson: rewriteSummaryJson(session.summaryJson, renames),
  };
}

/** Pure: returns a new bundle and the row count of each table before and after. */
export function rewriteBackup(
  bundle: BackupBundle,
  renames: SlugRenames,
): { bundle: BackupBundle; counts: TableCounts } {
  const data: Record<string, Row[]> = {};
  const counts: TableCounts = {};
  for (const [table, rows] of Object.entries(bundle.data)) {
    let next: Row[];
    if (table === 'aiSessions') {
      next = rows.map((session) => rewriteAiSession(session, renames));
    } else if (ITEM_TABLES.has(table)) {
      const renamed = (rows as ItemRow[]).map((row) => ({ ...row, item: renameRef(row.item, renames) }));
      next = mergeRows(table, renamed);
    } else {
      next = rows;
    }
    data[table] = next;
    counts[table] = { before: rows.length, after: next.length };
  }
  return { bundle: { ...bundle, data }, counts };
}

function collectRefs(bundle: BackupBundle): ItemRef[] {
  const refs: ItemRef[] = [];
  for (const [table, rows] of Object.entries(bundle.data)) {
    for (const row of rows) {
      if (row.item) refs.push(row.item as ItemRef);
      if (table !== 'aiSessions') continue;
      if (row.topicItem) refs.push(row.topicItem as ItemRef);
      refs.push(...((row.topicItems as ItemRef[] | undefined) ?? []));
      if (typeof row.summaryJson === 'string' && row.summaryJson !== '') {
        const words = (JSON.parse(row.summaryJson) as Row).wordsMet;
        if (Array.isArray(words)) {
          for (const word of words as Row[]) if (word.item) refs.push(word.item as ItemRef);
        }
      }
    }
  }
  return refs;
}

/** Sorted `"<kind>:<slug>"` keys of the bundle that `knownRefs` does not have. */
export function findUnmatchedRefs(bundle: BackupBundle, knownRefs: ReadonlySet<string>): string[] {
  const unmatched = new Set<string>();
  for (const ref of collectRefs(bundle)) {
    if (!knownRefs.has(refKey(ref))) unmatched.add(refKey(ref));
  }
  return Array.from(unmatched).sort();
}

function readKnownRefs(dbPath: string): Set<string> {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = db.prepare('SELECT item_type, slug FROM items').all() as {
      item_type: string;
      slug: string;
    }[];
    return new Set(rows.map((row) => `${row.item_type}:${row.slug}`));
  } finally {
    db.close();
  }
}

export function migratedPath(inputPath: string): string {
  return inputPath.replace(/\.json\.gz$/, '') + '-migrated.json.gz';
}

export type RewriteReport = {
  counts: TableCounts;
  renamedRefs: number;
  unmatched: string[];
  /** Null on a dry run or when a ref is unmatched. */
  outputPath: string | null;
};

export function rewriteBackupFile(options: {
  inputPath: string;
  renamesPath: string;
  dbPath: string;
  dryRun: boolean;
}): RewriteReport {
  const { inputPath, renamesPath, dbPath, dryRun } = options;
  if (!inputPath.endsWith('.json.gz')) {
    throw new Error(`Input must be a .json.gz backup: ${inputPath}`);
  }
  const bundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(inputPath)).toString('utf8')) as BackupBundle;
  const renames = JSON.parse(fs.readFileSync(renamesPath, 'utf8')) as SlugRenames;

  const result = rewriteBackup(bundle, renames);
  const renamedRefs = collectRefs(bundle).filter((ref) => {
    const renamed = renames[refKey(ref)];
    return renamed !== undefined && renamed !== refKey(ref);
  }).length;
  const unmatched = findUnmatchedRefs(result.bundle, readKnownRefs(dbPath));

  let outputPath: string | null = null;
  if (!dryRun && unmatched.length === 0) {
    outputPath = migratedPath(inputPath);
    // 'wx' fails when the file exists, so no run overwrites a file.
    fs.writeFileSync(outputPath, zlib.gzipSync(JSON.stringify(result.bundle)), { flag: 'wx' });
  }
  return { counts: result.counts, renamedRefs, unmatched, outputPath };
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main(): void {
  const inputArg = process.argv.slice(2).find((arg, i, args) => !arg.startsWith('--') && args[i - 1] !== '--db');
  if (!inputArg) {
    console.error('Usage: npx tsx scripts/rewrite-backup-slugs.ts <backup.json.gz> [--dry-run] [--db path]');
    process.exit(1);
  }
  const dbPath = path.resolve(argValue('--db') ?? DEFAULT_DB);
  try {
    const report = rewriteBackupFile({
      inputPath: path.resolve(inputArg),
      renamesPath: DEFAULT_RENAMES,
      dbPath,
      dryRun: process.argv.includes('--dry-run'),
    });
    console.log('table                    before  after');
    for (const [table, { before, after }] of Object.entries(report.counts)) {
      console.log(`${table.padEnd(24)} ${String(before).padStart(6)} ${String(after).padStart(6)}`);
    }
    console.log(`Renamed refs: ${report.renamedRefs}`);
    console.log(`Unmatched slugs against ${dbPath}: ${report.unmatched.length}`);
    for (const key of report.unmatched) console.log(`  ${key}`);
    if (report.outputPath) {
      console.log(`Wrote ${report.outputPath}`);
    } else {
      console.log('Wrote nothing.');
    }
    if (report.unmatched.length > 0) process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1]?.includes('rewrite-backup-slugs')) {
  main();
}
