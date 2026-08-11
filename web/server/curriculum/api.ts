import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import {
  buildAuditBySlug,
  getAuditFindings,
  reloadAuditFindings,
  runAudit,
  summarizeAudit,
  type AuditFinding,
  type FindingSeverity,
} from './audit.js';
import {
  buildBuildOrder,
  buildGraphSummary,
  buildLevelGraph,
  buildNeighborhood,
} from './graph.js';
import { getCurriculum, loadTargets, reload } from './loader.js';
import { runCompile, runValidate } from './pipeline.js';
import {
  isSkeleton,
  itemKey,
  SKELETON_THRESHOLD,
  type ContentItem,
  type ContentType,
  type CurriculumIndex,
  type DependencyRef,
  type DependencySummary,
  type JlptLevel,
  type ReviewStatus,
} from './types.js';
import { saveItem, updateReviewStatus } from './writer.js';

const EDITABLE_STATUSES: Exclude<ReviewStatus, 'none'>[] = [
  'draft',
  'reviewed',
  'flagged_for_rewrite',
];

const CONTENT_TYPES: ContentType[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
  'reading',
];

const LEVELS: JlptLevel[] = ['N5', 'N4'];

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

type SlugLink = { slug: string; type: ContentType | null };

function resolveSlugLinks(index: CurriculumIndex, slugs: string[]): SlugLink[] {
  return slugs.map((slug) => {
    for (const type of CONTENT_TYPES) {
      if (index.bySlug.has(itemKey(type, slug))) return { slug, type };
    }
    return { slug, type: null };
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

function targetKeyForType(
  type: ContentType,
): 'radicals' | 'kanji' | 'vocabulary' | 'grammar' | 'readings' {
  switch (type) {
    case 'radical':
      return 'radicals';
    case 'kanji':
      return 'kanji';
    case 'vocabulary':
      return 'vocabulary';
    case 'grammar':
      return 'grammar';
    case 'reading':
      return 'readings';
  }
}

function parseType(value: unknown): ContentType | undefined {
  if (typeof value !== 'string') return undefined;
  return CONTENT_TYPES.includes(value as ContentType)
    ? (value as ContentType)
    : undefined;
}

function parseLevel(value: unknown): JlptLevel | undefined {
  if (typeof value !== 'string') return undefined;
  return LEVELS.includes(value as JlptLevel)
    ? (value as JlptLevel)
    : undefined;
}

function parseStatus(value: unknown): ReviewStatus | undefined {
  if (typeof value !== 'string') return undefined;
  return STATUSES.includes(value as ReviewStatus)
    ? (value as ReviewStatus)
    : undefined;
}

function serializeListItem(
  item: ContentItem,
  auditBySlug: Map<string, AuditFinding[]>,
): Omit<ContentItem, 'raw'> & {
  auditSeverity: FindingSeverity | null;
  auditFindingCount: number;
} {
  const { raw: _raw, ...rest } = item;
  const findings = auditBySlug.get(item.slug) ?? [];
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
  const findings = auditBySlug.get(item.slug) ?? [];
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
    if (skeletonOnly && !isSkeleton(item)) return false;
    if (missing && !item.completeness.missing.includes(missing)) return false;
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

    const byTypeLevel = {} as Record<
      ContentType,
      Record<JlptLevel, OverviewBucket>
    >;

    for (const type of CONTENT_TYPES) {
      byTypeLevel[type] = {
        N5: emptyBucket(targets.N5[targetKeyForType(type)]),
        N4: emptyBucket(targets.N4[targetKeyForType(type)]),
      };
    }

    for (const item of index.items) {
      const bucket = byTypeLevel[item.type][item.level];
      bucket.total += 1;
      bucket.status[item.reviewStatus] += 1;
      bucket.meanCompleteness += item.completeness.percent;
      if (isSkeleton(item)) bucket.skeletonCount += 1;
    }

    for (const type of CONTENT_TYPES) {
      for (const level of LEVELS) {
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
      skeletonLabel: 'skeleton (<60% complete)',
    });
  });

  router.get('/items', (req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const auditBySlug = buildAuditBySlug(getAuditFindings(repoRoot));
    const filtered = sortItems(
      filterItems(index.items, req.query, auditBySlug),
      typeof req.query.sort === 'string' ? req.query.sort : undefined,
    );

    const page = Math.max(1, Number(req.query.page) || 1);
    const requestedPageSize = Math.max(
      1,
      Math.floor(Number(req.query.pageSize) || 50),
    );
    // Cap at filtered length so "show all" works for any list size.
    const pageSize = Math.min(
      requestedPageSize,
      Math.max(filtered.length, 1),
    );
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    res.json({
      total: filtered.length,
      page,
      pageSize,
      items: pageItems.map((item) => serializeListItem(item, auditBySlug)),
    });
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
      auditFindings: auditBySlug.get(item.slug) ?? [],
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

    const result = saveItem(repoRoot, type, item.level, req.params.slug, req.body as Record<string, unknown>);
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

    const result = updateReviewStatus(repoRoot, type, item.level, req.params.slug, reviewStatus);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    const updated = getCurriculum(repoRoot).bySlug.get(itemKey(type, req.params.slug));
    res.json({ ok: true, item: updated });
  });

  router.post('/reload', (_req: Request, res: Response) => {
    const index = reload(repoRoot);
    reloadAuditFindings(repoRoot);
    res.json({ ok: true, itemCount: index.items.length });
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
