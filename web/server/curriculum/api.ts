import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import {
  buildAuditBySlug,
  getAuditFindings,
  getFindingsForItem,
  parseQualifiedSlug,
  reloadAuditFindings,
  runAudit,
  summarizeAudit,
  type AuditFinding,
  type FindingSeverity,
} from './audit.js';
import { expectedFields } from './completeness.js';
import { loadGeneratedPassages } from './generatedPassages.js';
import {
  buildBuildOrder,
  buildGraphSummary,
  buildLevelGraph,
  buildNeighborhood,
} from './graph.js';
import { getCurriculum, loadTargets, reload } from './loader.js';
import { runCompile, runValidate } from './pipeline.js';
import { readGrammarLessonStatus, readGrammarMnemonicStatus } from './sidecar.js';
import {
  isSkeleton,
  itemKey,
  MAX_LEVEL,
  SKELETON_THRESHOLD,
  type ContentItem,
  type ContentType,
  type CurriculumIndex,
  type DependencyRef,
  type DependencySummary,
  type ReviewStatus,
} from './types.js';
import {
  saveItem,
  updateGrammarMnemonicReviewStatus,
  updateReviewStatus,
  updateReviewStatusBulk,
} from './writer.js';

const EDITABLE_STATUSES: ReviewStatus[] = [
  'draft',
  'reviewed',
  'flagged_for_rewrite',
  'none',
];

const CONTENT_TYPES: ContentType[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
  'reading',
];

const STATUSES: ReviewStatus[] = [
  'draft',
  'reviewed',
  'flagged_for_rewrite',
  'none',
];

const SEVERITIES: FindingSeverity[] = ['ERROR', 'WARNING', 'INFO'];
const SEVERITY_RANK: Record<FindingSeverity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

function worstSeverity(findings: AuditFinding[]): FindingSeverity | null {
  let worst: FindingSeverity | null = null;
  for (const f of findings) {
    if (worst === null || SEVERITY_RANK[f.severity] < SEVERITY_RANK[worst]) {
      worst = f.severity;
    }
  }
  return worst;
}

function parseSeverity(value: unknown): FindingSeverity | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.toUpperCase();
  return SEVERITIES.includes(upper as FindingSeverity)
    ? (upper as FindingSeverity)
    : undefined;
}

/**
 * Type prefixes accepted by /items/resolve. Wider than audit_shipped.py's
 * vocabulary (`KIND_TO_TYPE` in audit.ts): a pasted slug list is hand- or
 * agent-written, so it also uses the plural directory names and `reading`.
 */
const TYPE_PREFIXES: Record<string, ContentType> = {
  radical: 'radical',
  radicals: 'radical',
  kanji: 'kanji',
  vocab: 'vocabulary',
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  reading: 'reading',
  readings: 'reading',
};

type SlugLink = { slug: string; type: ContentType | null };

function resolveSlugLinks(index: CurriculumIndex, slugs: string[]): SlugLink[] {
  return slugs.map((raw) => {
    const qualified = parseQualifiedSlug(raw);
    if (qualified) {
      const { type, slug } = qualified;
      return index.bySlug.has(itemKey(type, slug)) ? { slug, type } : { slug, type: null };
    }
    for (const type of CONTENT_TYPES) {
      if (index.bySlug.has(itemKey(type, raw))) return { slug: raw, type };
    }
    return { slug: raw, type: null };
  });
}

type OverviewBucket = {
  total: number;
  status: Record<ReviewStatus, number>;
  meanCompleteness: number;
  skeletonCount: number;
  target: number;
  remaining: number;
};

function emptyStatus(): Record<ReviewStatus, number> {
  return {
    draft: 0,
    reviewed: 0,
    flagged_for_rewrite: 0,
    none: 0,
  };
}

function emptyBucket(target: number): OverviewBucket {
  return {
    total: 0,
    status: emptyStatus(),
    meanCompleteness: 0,
    skeletonCount: 0,
    target,
    remaining: target,
  };
}

type GapBucket = { total: number; missing: Record<string, number> };

function emptyGapBucket(type: ContentType): GapBucket {
  const missing: Record<string, number> = {};
  for (const field of expectedFields(type)) {
    missing[field] = 0;
  }
  return { total: 0, missing };
}

function parseType(value: unknown): ContentType | undefined {
  if (typeof value !== 'string') return undefined;
  return CONTENT_TYPES.includes(value as ContentType)
    ? (value as ContentType)
    : undefined;
}

/** A ladder level, 1..MAX_LEVEL, from a query or path string. */
function parseLevel(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const level = Number(value);
  return level >= 1 && level <= MAX_LEVEL ? level : undefined;
}

/** The ladder levels that hold any item, in order. */
function levelsOf(index: CurriculumIndex): number[] {
  return [...new Set(index.items.map((item) => item.level))].sort((a, b) => a - b);
}

function parseStatus(value: unknown): ReviewStatus | undefined {
  if (typeof value !== 'string') return undefined;
  return STATUSES.includes(value as ReviewStatus)
    ? (value as ReviewStatus)
    : undefined;
}

function parseModel(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function serializeListItem(
  item: ContentItem,
  auditBySlug: Map<string, AuditFinding[]>,
): Omit<ContentItem, 'raw'> & {
  auditSeverity: FindingSeverity | null;
  auditFindingCount: number;
} {
  const { raw: _raw, ...rest } = item;
  const findings = getFindingsForItem(auditBySlug, item.type, item.slug);
  return {
    ...rest,
    auditSeverity: worstSeverity(findings),
    auditFindingCount: findings.length,
  };
}

function sortItems(
  items: ContentItem[],
  sort: string | undefined,
): ContentItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'completeness':
    case 'completeness_asc':
      sorted.sort(
        (a, b) =>
          a.completeness.percent - b.completeness.percent ||
          a.sortOrder - b.sortOrder,
      );
      break;
    case 'completeness_desc':
      sorted.sort(
        (a, b) =>
          b.completeness.percent - a.completeness.percent ||
          a.sortOrder - b.sortOrder,
      );
      break;
    case 'slug':
      sorted.sort((a, b) => a.slug.localeCompare(b.slug));
      break;
    case 'sort_order':
    default:
      sorted.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
      );
      break;
  }
  return sorted;
}

function matchesAuditFilter(
  item: ContentItem,
  audit: string,
  auditBySlug: Map<string, AuditFinding[]>,
): boolean {
  const findings = getFindingsForItem(auditBySlug, item.type, item.slug);
  if (audit === 'any') return findings.length > 0;
  const severity = audit.toUpperCase();
  return findings.some((f) => f.severity === severity);
}

function filterItems(
  items: ContentItem[],
  query: Request['query'],
  auditBySlug: Map<string, AuditFinding[]>,
): ContentItem[] {
  const type = parseType(query.type);
  const level = parseLevel(query.level);
  const status = parseStatus(query.status);
  const model = parseModel(query.model);
  const skeletonOnly = query.skeleton === 'true' || query.skeleton === '1';
  const missing =
    typeof query.missing === 'string' && query.missing.length > 0
      ? query.missing
      : undefined;
  const q =
    typeof query.q === 'string' && query.q.trim().length > 0
      ? query.q.trim().toLowerCase()
      : undefined;
  const audit =
    typeof query.audit === 'string' && query.audit.length > 0
      ? query.audit.toLowerCase()
      : undefined;

  return items.filter((item) => {
    if (type && item.type !== type) return false;
    if (level && item.level !== level) return false;
    if (model && item.meta?.generator_model !== model) return false;
    if (skeletonOnly && !isSkeleton(item)) return false;
    // Optional fields are filterable too — the Guide links at them so a
    // maintainer can see which items skipped one.
    if (
      missing &&
      !item.completeness.missing.includes(missing) &&
      !item.completeness.optionalMissing.includes(missing)
    ) {
      return false;
    }
    if (q) {
      const haystack =
        `${item.slug} ${item.primaryForm} ${item.meaning}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // Status and audit are OR'd when both are set (e.g. reviewed ∪ audit errors).
    // Alone, each still narrows the list as before.
    const statusOk = !status || item.reviewStatus === status;
    const auditOk = !audit || matchesAuditFilter(item, audit, auditBySlug);
    if (status && audit) {
      if (!statusOk && !auditOk) return false;
    } else if (!statusOk || !auditOk) {
      return false;
    }

    return true;
  });
}

function resolveDependencySummary(
  index: CurriculumIndex,
  type: ContentType,
  slug: string,
): DependencySummary {
  const incoming: DependencyRef[] = [];
  const outgoing: DependencyRef[] = [];

  for (const edge of index.edges) {
    if (edge.to_type === type && edge.to_slug === slug) {
      const from = index.bySlug.get(
        itemKey(edge.from_type as ContentType, edge.from_slug),
      );
      incoming.push({
        type: edge.from_type as ContentType,
        slug: edge.from_slug,
        primaryForm: from?.primaryForm ?? edge.from_slug,
        relationship: edge.relationship_type,
      });
    }
    if (edge.from_type === type && edge.from_slug === slug) {
      const to = index.bySlug.get(
        itemKey(edge.to_type as ContentType, edge.to_slug),
      );
      outgoing.push({
        type: edge.to_type as ContentType,
        slug: edge.to_slug,
        primaryForm: to?.primaryForm ?? edge.to_slug,
        relationship: edge.relationship_type,
      });
    }
  }

  return { incoming, outgoing };
}

export function createCurriculumRouter(
  repoRoot: string,
  webRoot: string,
): Router {
  const router = createRouter();

  router.get('/overview', (_req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const targets = loadTargets(webRoot);

    const levels = levelsOf(index);
    const byTypeLevel = {} as Record<
      ContentType,
      Record<number, OverviewBucket>
    >;

    // targets.json is per JLPT level, which no ladder level maps to, so a
    // ladder bucket carries no target.
    for (const type of CONTENT_TYPES) {
      byTypeLevel[type] = {} as Record<number, OverviewBucket>;
      for (const level of levels) {
        byTypeLevel[type][level] = emptyBucket(0);
      }
    }

    for (const item of index.items) {
      const bucket = byTypeLevel[item.type][item.level];
      bucket.total += 1;
      bucket.status[item.reviewStatus] += 1;
      bucket.meanCompleteness += item.completeness.percent;
      if (isSkeleton(item)) bucket.skeletonCount += 1;
    }

    for (const type of CONTENT_TYPES) {
      for (const level of levels) {
        const bucket = byTypeLevel[type][level];
        bucket.meanCompleteness =
          bucket.total === 0 ? 0 : bucket.meanCompleteness / bucket.total;
        bucket.remaining = bucket.target - bucket.total;
      }
    }

    const totals = {
      radicals: index.items.filter((i) => i.type === 'radical').length,
      kanji: index.items.filter((i) => i.type === 'kanji').length,
      vocabulary: index.items.filter((i) => i.type === 'vocabulary').length,
      grammar: index.items.filter((i) => i.type === 'grammar').length,
      reading_passages: index.items.filter((i) => i.type === 'reading').length,
      total_items: index.items.filter((i) => i.type !== 'reading').length,
      dependency_edges: index.edges.length,
    };

    res.json({
      metadata: index.metadata,
      targets,
      byTypeLevel,
      totals,
      skeletonThreshold: SKELETON_THRESHOLD,
      skeletonLabel: 'skeleton (≤60% complete)',
    });
  });

  /**
   * How many items are missing each completeness field, per type and level.
   * The Guide needs one number per (type, field) to size each generation
   * stage; asking `/items?missing=…` once per field would be ~20 requests
   * over the same index walk.
   */
  router.get('/gaps', (_req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);

    const byTypeLevel = {} as Record<ContentType, Record<number, GapBucket>>;
    for (const type of CONTENT_TYPES) {
      byTypeLevel[type] = {} as Record<number, GapBucket>;
      for (const level of levelsOf(index)) {
        byTypeLevel[type][level] = emptyGapBucket(type);
      }
    }

    for (const item of index.items) {
      const bucket = byTypeLevel[item.type][item.level];
      bucket.total += 1;
      // Optional fields count here as well: the Guide sizes stages from these
      // numbers and still wants to see how many items skipped one.
      for (const field of [
        ...item.completeness.missing,
        ...item.completeness.optionalMissing,
      ]) {
        bucket.missing[field] = (bucket.missing[field] ?? 0) + 1;
      }
    }

    res.json({ byTypeLevel });
  });

  /** Distinct generator_model values seen across all items, for the filter dropdown. */
  router.get('/items/models', (_req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const models = new Set<string>();
    for (const item of index.items) {
      if (item.meta?.generator_model) models.add(item.meta.generator_model);
    }
    res.json({ models: [...models].sort() });
  });

  router.get('/items', (req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const auditBySlug = buildAuditBySlug(getAuditFindings(repoRoot));
    const filtered = sortItems(
      filterItems(index.items, req.query, auditBySlug),
      typeof req.query.sort === 'string' ? req.query.sort : undefined,
    );

    // Unpaged on purpose: the curriculum is read off local disk and the whole
    // filtered set is already in memory, so slicing it only forced the client
    // into round-trips for data it was always going to ask for. The largest
    // list (vocabulary) is ~400 KB over localhost.
    res.json({
      total: filtered.length,
      items: filtered.map((item) => serializeListItem(item, auditBySlug)),
    });
  });

  /**
   * Pasted tokens -> the items they name, in input order. A bare slug is looked
   * up under every content type because ~23 slugs exist under two of them
   * (radical "mizu" vs. vocabulary "mizu"); both matches come back so the caller
   * can make the user choose instead of silently marking the wrong file.
   * `matches: []` means the token names nothing in the curriculum.
   */
  router.post('/items/resolve', (req: Request, res: Response) => {
    const rawSlugs = req.body?.slugs;
    if (!Array.isArray(rawSlugs)) {
      res.status(400).json({ error: 'slugs must be an array of strings' });
      return;
    }

    const index = getCurriculum(repoRoot);
    const auditBySlug = buildAuditBySlug(getAuditFindings(repoRoot));

    const rows: { input: string; matches: unknown[] }[] = [];
    const seen = new Set<string>();

    for (const raw of rawSlugs) {
      if (typeof raw !== 'string') continue;
      const input = raw.trim();
      if (input.length === 0 || seen.has(input)) continue;
      seen.add(input);

      const separator = input.indexOf(':');
      const prefixed =
        separator === -1
          ? undefined
          : TYPE_PREFIXES[input.slice(0, separator).toLowerCase()];

      const matches: ContentItem[] = [];
      if (prefixed) {
        const item = index.bySlug.get(itemKey(prefixed, input.slice(separator + 1)));
        if (item) matches.push(item);
      } else {
        for (const type of CONTENT_TYPES) {
          const item = index.bySlug.get(itemKey(type, input));
          if (item) matches.push(item);
        }
      }

      rows.push({
        input,
        matches: matches.map((item) => serializeListItem(item, auditBySlug)),
      });
    }

    res.json({ total: rows.length, rows });
  });

  router.get('/items/neighbors', (req: Request, res: Response) => {
    const type = parseType(req.query.type);
    const slug = typeof req.query.slug === 'string' ? req.query.slug : undefined;
    if (!type || !slug) {
      res.status(400).json({ error: 'type and slug are required' });
      return;
    }

    const index = getCurriculum(repoRoot);
    const auditBySlug = buildAuditBySlug(getAuditFindings(repoRoot));
    const filtered = sortItems(
      filterItems(index.items, req.query, auditBySlug),
      typeof req.query.sort === 'string' ? req.query.sort : undefined,
    );

    const indexInList = filtered.findIndex(
      (item) => item.type === type && item.slug === slug,
    );

    const toNeighbor = (item: ContentItem | undefined) =>
      item
        ? {
            type: item.type,
            slug: item.slug,
            primaryForm: item.primaryForm,
            meaning: item.meaning,
          }
        : null;

    res.json({
      total: filtered.length,
      index: indexInList,
      prev: indexInList > 0 ? toNeighbor(filtered[indexInList - 1]) : null,
      next:
        indexInList >= 0 && indexInList < filtered.length - 1
          ? toNeighbor(filtered[indexInList + 1])
          : null,
    });
  });

  router.get('/item/:type/:slug', (req: Request, res: Response) => {
    const type = parseType(req.params.type);
    if (!type) {
      res.status(400).json({ error: `Unknown type: ${req.params.type}` });
      return;
    }

    const index = getCurriculum(repoRoot);
    const item = index.bySlug.get(itemKey(type, req.params.slug));
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const auditBySlug = buildAuditBySlug(getAuditFindings(repoRoot));

    res.json({
      ...item,
      isSkeleton: isSkeleton(item),
      dependencySummary: resolveDependencySummary(index, type, item.slug),
      auditFindings: getFindingsForItem(auditBySlug, type, item.slug),
      // A grammar row's own status is the merge of these two; each has its own control.
      lessonReviewStatus: type === 'grammar' ? readGrammarLessonStatus(repoRoot, item.slug) : null,
      mnemonicReviewStatus: type === 'grammar' ? readGrammarMnemonicStatus(repoRoot, item.slug) : null,
    });
  });

  router.put('/item/:type/:slug', (req: Request, res: Response) => {
    const type = parseType(req.params.type);
    if (!type) {
      res.status(400).json({ error: `Unknown type: ${req.params.type}` });
      return;
    }

    const index = getCurriculum(repoRoot);
    const item = index.bySlug.get(itemKey(type, req.params.slug));
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      res.status(400).json({ ok: false, errors: ['Request body must be the full item object'] });
      return;
    }

    const result = saveItem(repoRoot, type, req.params.slug, req.body as Record<string, unknown>);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    const updated = getCurriculum(repoRoot).bySlug.get(itemKey(type, req.params.slug));
    res.json({ ok: true, item: updated });
  });

  router.patch('/item/:type/:slug/meta', (req: Request, res: Response) => {
    const type = parseType(req.params.type);
    if (!type) {
      res.status(400).json({ error: `Unknown type: ${req.params.type}` });
      return;
    }

    const index = getCurriculum(repoRoot);
    const item = index.bySlug.get(itemKey(type, req.params.slug));
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const reviewStatus = req.body?.review_status;
    if (!EDITABLE_STATUSES.includes(reviewStatus)) {
      res.status(400).json({
        ok: false,
        errors: [`review_status must be one of ${EDITABLE_STATUSES.join(', ')}`],
      });
      return;
    }

    const result = updateReviewStatus(repoRoot, type, req.params.slug, reviewStatus);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    const updated = getCurriculum(repoRoot).bySlug.get(itemKey(type, req.params.slug));
    res.json({ ok: true, item: updated });
  });

  router.patch('/item/grammar/:slug/mnemonic-meta', (req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const item = index.bySlug.get(itemKey('grammar', req.params.slug));
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    const reviewStatus = req.body?.review_status;
    if (!EDITABLE_STATUSES.includes(reviewStatus)) {
      res.status(400).json({
        ok: false,
        errors: [`review_status must be one of ${EDITABLE_STATUSES.join(', ')}`],
      });
      return;
    }
    const result = updateGrammarMnemonicReviewStatus(repoRoot, req.params.slug, reviewStatus);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const updated = getCurriculum(repoRoot).bySlug.get(itemKey('grammar', req.params.slug));
    res.json({ ok: true, item: updated });
  });

  router.post('/items/bulk-status', (req: Request, res: Response) => {
    const reviewStatus = req.body?.review_status;
    if (!EDITABLE_STATUSES.includes(reviewStatus)) {
      res.status(400).json({
        ok: false,
        errors: [`review_status must be one of ${EDITABLE_STATUSES.join(', ')}`],
      });
      return;
    }

    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ ok: false, errors: ['items must be a non-empty array'] });
      return;
    }

    const index = getCurriculum(repoRoot);
    const errors: string[] = [];
    const resolved: { type: ContentType; slug: string }[] = [];

    for (const raw of rawItems) {
      const type = parseType(raw?.type);
      const slug = typeof raw?.slug === 'string' ? raw.slug : undefined;
      if (!type || !slug) {
        errors.push(`Invalid item: ${JSON.stringify(raw)}`);
        continue;
      }
      const item = index.bySlug.get(itemKey(type, slug));
      if (!item) {
        errors.push(`${type}/${slug}: not found`);
        continue;
      }
      resolved.push({ type, slug });
    }

    if (errors.length > 0) {
      res.status(400).json({ ok: false, errors });
      return;
    }

    const result = updateReviewStatusBulk(repoRoot, resolved, reviewStatus);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    res.json({ ok: true, updated: result.updated });
  });

  router.post('/reload', (_req: Request, res: Response) => {
    const index = reload(repoRoot);
    reloadAuditFindings(repoRoot);
    res.json({ ok: true, itemCount: index.items.length });
  });

  // Read-only: the Phase 4 artifact is not shipped content and Studio must not
  // set its review status (see generatedPassages.ts).
  router.get('/generated', (_req: Request, res: Response) => {
    const result = loadGeneratedPassages(repoRoot);
    if (!result.ok) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  });

  router.get('/audit/summary', (_req: Request, res: Response) => {
    res.json(summarizeAudit(repoRoot));
  });

  router.post('/audit/run', (_req: Request, res: Response) => {
    runAudit(repoRoot).then((result) => {
      if (!result.ok) {
        res.status(500).json(result);
        return;
      }
      res.json(result);
    });
  });

  router.get('/audit/findings', (req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const severity = parseSeverity(req.query.severity);
    const check =
      typeof req.query.check === 'string' && req.query.check.length > 0
        ? req.query.check
        : undefined;
    const type = parseType(req.query.type);

    const filtered = getAuditFindings(repoRoot)
      .map((finding) => ({ finding, links: resolveSlugLinks(index, finding.slugs) }))
      .filter(({ finding, links }) => {
        if (severity && finding.severity !== severity) return false;
        if (check && finding.check !== check) return false;
        if (type && !links.some((l) => l.type === type)) return false;
        return true;
      });

    res.json({
      total: filtered.length,
      findings: filtered.map(({ finding, links }) => ({ ...finding, links })),
    });
  });

  router.get('/graph/neighborhood', (req: Request, res: Response) => {
    const type = parseType(req.query.type);
    const slug = typeof req.query.slug === 'string' ? req.query.slug : undefined;
    if (!type || !slug) {
      res.status(400).json({ error: 'type and slug are required' });
      return;
    }

    const index = getCurriculum(repoRoot);
    if (!index.bySlug.has(itemKey(type, slug))) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const depthRaw = Number(req.query.depth);
    const depth = Math.min(3, Math.max(1, Number.isFinite(depthRaw) ? depthRaw : 2));

    const { nodes, edges } = buildNeighborhood(index, type, slug, depth);
    res.json({ center: { type, slug }, nodes, edges });
  });

  router.get('/graph/level/:level', (req: Request, res: Response) => {
    const level = parseLevel(req.params.level);
    if (!level) {
      res.status(400).json({ error: `Unknown level: ${req.params.level}` });
      return;
    }

    const index = getCurriculum(repoRoot);
    const { nodes, edges } = buildLevelGraph(index, level);
    res.json({ level, nodes, edges });
  });

  router.get('/graph/summary', (_req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    res.json(buildGraphSummary(index));
  });

  router.get('/graph/build-order', (req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const level = parseLevel(req.query.level);
    res.json(buildBuildOrder(index, level));
  });

  router.post('/pipeline/validate', (_req: Request, res: Response) => {
    runValidate(repoRoot).then((result) => res.json(result));
  });

  router.post('/pipeline/compile', (_req: Request, res: Response) => {
    runCompile(repoRoot, webRoot).then((result) => res.json(result));
  });

  return router;
}
