import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { getCurriculum, loadTargets } from './loader.js';
import {
  isSkeleton,
  itemKey,
  SKELETON_THRESHOLD,
  type ContentItem,
  type ContentType,
  type JlptLevel,
  type ReviewStatus,
} from './types.js';

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

function serializeListItem(item: ContentItem): Omit<ContentItem, 'raw'> {
  const { raw: _raw, ...rest } = item;
  return rest;
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

function filterItems(
  items: ContentItem[],
  query: Request['query'],
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

  return items.filter((item) => {
    if (type && item.type !== type) return false;
    if (level && item.level !== level) return false;
    if (status && item.reviewStatus !== status) return false;
    if (skeletonOnly && !isSkeleton(item)) return false;
    if (missing && !item.completeness.missing.includes(missing)) return false;
    if (q) {
      const haystack =
        `${item.slug} ${item.primaryForm} ${item.meaning}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
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
    const filtered = sortItems(
      filterItems(index.items, req.query),
      typeof req.query.sort === 'string' ? req.query.sort : undefined,
    );

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Number(req.query.pageSize) || 50),
    );
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    res.json({
      total: filtered.length,
      page,
      pageSize,
      items: pageItems.map(serializeListItem),
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

    res.json({
      ...item,
      isSkeleton: isSkeleton(item),
    });
  });

  return router;
}
