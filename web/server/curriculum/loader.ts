import fs from 'node:fs';
import path from 'node:path';
import { computeCompleteness } from './completeness.js';
import {
  itemKey,
  JLPT_LEVELS,
  type ContentItem,
  type ContentType,
  type CurriculumIndex,
  type CurriculumMetadata,
  type DependencyEdge,
  type JlptLevel,
  type ReviewStatus,
  type SidecarMeta,
  type TargetsFile,
} from './types.js';

const TYPE_BY_DIR: Record<string, { type: ContentType; arrayKey: 'items' | 'passages' }> = {
  radicals: { type: 'radical', arrayKey: 'items' },
  kanji: { type: 'kanji', arrayKey: 'items' },
  vocabulary: { type: 'vocabulary', arrayKey: 'items' },
  grammar: { type: 'grammar', arrayKey: 'items' },
  readings: { type: 'reading', arrayKey: 'passages' },
};

let cache: CurriculumIndex | null = null;
let cachedRoot: string | null = null;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

/**
 * Same skip rules as discoverJsonFilesIn in scripts/validate-schema.ts:
 * skip _build/, anything under schema/, and the mnemonics.json /
 * examples.json / pool.json sidecars next to the level files.
 */
function shouldSkipDir(name: string): boolean {
  return name === '_build' || name === 'schema';
}

const SIDECAR_FILE_NAMES: ReadonlySet<string> = new Set(['mnemonics.json', 'examples.json', 'pool.json']);

function discoverShippedFiles(curriculumDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) {
          walk(fullPath);
        }
        continue;
      }
      if (entry.name.endsWith('.json') && !SIDECAR_FILE_NAMES.has(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(curriculumDir);
  return files.sort();
}

function parseLevel(value: unknown): JlptLevel {
  if (typeof value === 'string' && (JLPT_LEVELS as readonly string[]).includes(value)) {
    return value as JlptLevel;
  }
  throw new Error(`Unsupported jlpt_level: ${String(value)}`);
}

function reviewStatusFromMeta(meta: unknown): ReviewStatus {
  if (!meta || typeof meta !== 'object') return 'none';
  const status = (meta as SidecarMeta).review_status;
  if (
    status === 'draft' ||
    status === 'reviewed' ||
    status === 'flagged_for_rewrite'
  ) {
    return status;
  }
  return 'none';
}

function asMeta(meta: unknown): SidecarMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  return meta as SidecarMeta;
}

function passageSlug(raw: Record<string, unknown>, level: JlptLevel): string {
  if (typeof raw.slug === 'string' && raw.slug.length > 0) {
    return raw.slug;
  }
  const sortOrder = typeof raw.sort_order === 'number' ? raw.sort_order : 0;
  return `passage-${level.toLowerCase()}-${sortOrder}`;
}

function normalizeItem(
  type: ContentType,
  level: JlptLevel,
  raw: Record<string, unknown>,
  assetsDir: string,
): ContentItem {
  const slug =
    type === 'reading' ? passageSlug(raw, level) : String(raw.slug ?? '');

  const primaryForm =
    type === 'reading'
      ? String(raw.title ?? '')
      : String(raw.primary_form ?? '');

  const meaning =
    type === 'reading'
      ? String(raw.summary_en ?? raw.english_translation ?? '')
      : String(raw.meaning ?? '');

  const sortOrder = typeof raw.sort_order === 'number' ? raw.sort_order : 0;
  const meta = asMeta(raw._meta);

  return {
    type,
    level,
    slug,
    primaryForm,
    meaning,
    sortOrder,
    reviewStatus: reviewStatusFromMeta(raw._meta),
    meta,
    completeness: computeCompleteness(type, raw, assetsDir),
    raw,
  };
}

export function loadCurriculum(root: string): CurriculumIndex {
  const curriculumDir = path.join(root, 'curriculum');
  const assetsDir = path.join(root, 'mobile', 'assets');
  const files = discoverShippedFiles(curriculumDir);

  const items: ContentItem[] = [];
  let edges: DependencyEdge[] = [];
  let metadata: CurriculumMetadata | null = null;

  for (const filePath of files) {
    const relative = path.relative(curriculumDir, filePath).replace(/\\/g, '/');

    if (relative === 'metadata.json') {
      metadata = readJson<CurriculumMetadata>(filePath);
      continue;
    }

    if (relative === 'dependencies/graph.json') {
      edges = readJson<{ edges: DependencyEdge[] }>(filePath).edges ?? [];
      continue;
    }

    const topDir = relative.split('/')[0] ?? '';
    const mapping = TYPE_BY_DIR[topDir];
    if (!mapping) continue;

    const file = readJson<{
      jlpt_level: string;
      items?: Record<string, unknown>[];
      passages?: Record<string, unknown>[];
    }>(filePath);

    const level = parseLevel(file.jlpt_level);
    const rows =
      (mapping.arrayKey === 'items' ? file.items : file.passages) ?? [];
    for (const row of rows) {
      items.push(normalizeItem(mapping.type, level, row, assetsDir));
    }
  }

  if (!metadata) {
    throw new Error('curriculum/metadata.json not found');
  }

  const bySlug = new Map<string, ContentItem>();
  for (const item of items) {
    bySlug.set(itemKey(item.type, item.slug), item);
  }

  return { items, edges, metadata, bySlug };
}

export function getCurriculum(root: string): CurriculumIndex {
  if (cache && cachedRoot === root) {
    return cache;
  }
  cache = loadCurriculum(root);
  cachedRoot = root;
  return cache;
}

export function reload(root: string): CurriculumIndex {
  cache = null;
  cachedRoot = null;
  return getCurriculum(root);
}

export function loadTargets(webRoot: string): TargetsFile {
  const filePath = path.join(webRoot, 'targets.json');
  const raw = readJson<Partial<TargetsFile> & { _comment?: string }>(filePath);
  const targets = {} as TargetsFile;
  for (const level of JLPT_LEVELS) {
    const entry = raw[level];
    if (!entry) {
      throw new Error(`targets.json is missing an entry for ${level}`);
    }
    targets[level] = entry;
  }
  return targets;
}
