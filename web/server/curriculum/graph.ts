import {
  isSkeleton,
  itemKey,
  type ContentItem,
  type ContentType,
  type CurriculumIndex,
  type DependencyEdge,
  type JlptLevel,
  type ReviewStatus,
} from './types.js';

export type GraphNode = {
  type: ContentType;
  slug: string;
  primaryForm: string;
  level: JlptLevel | null;
  reviewStatus: ReviewStatus | null;
  completeness: number | null;
  missing: boolean;
};

export type GraphEdgeOut = {
  fromType: ContentType;
  fromSlug: string;
  toType: ContentType;
  toSlug: string;
  relationship: string;
};

export type GraphEdgeTypeCount = {
  fromType: ContentType;
  toType: ContentType;
  relationship: string;
  count: number;
};

export type GraphOrphan = {
  type: ContentType;
  slug: string;
  primaryForm: string;
  level: JlptLevel;
};

export type GraphDanglingEdge = {
  fromType: string;
  fromSlug: string;
  toType: string;
  toSlug: string;
  relationship: string;
  missingSide: 'from' | 'to' | 'both';
};

export type GraphSummary = {
  totalEdges: number;
  edgeTypeCounts: GraphEdgeTypeCount[];
  orphans: GraphOrphan[];
  dangling: GraphDanglingEdge[];
};

export type BuildOrderReason = 'missing' | 'draft' | 'skeleton';

export type BuildOrderBlocker = {
  type: ContentType | null;
  slug: string;
  primaryForm: string | null;
  relationship: string;
  reasons: BuildOrderReason[];
};

export type BuildOrderRow = {
  type: ContentType;
  slug: string;
  primaryForm: string;
  level: JlptLevel;
  outDegree: number;
  blockedBy: BuildOrderBlocker[];
};

/** Types that actually participate in dependencies/graph.json; readings never do. */
const GRAPH_TYPES: ContentType[] = ['radical', 'kanji', 'vocabulary', 'grammar'];

/** Hard prerequisites for build-order purposes; 'reinforces' (grammar->vocab) is a soft link. */
const PREREQUISITE_RELATIONSHIPS = new Set(['builds_on', 'requires']);

function nodeFromItem(
  type: ContentType,
  slug: string,
  item: ContentItem | undefined,
): GraphNode {
  if (!item) {
    return {
      type,
      slug,
      primaryForm: slug,
      level: null,
      reviewStatus: null,
      completeness: null,
      missing: true,
    };
  }
  return {
    type,
    slug,
    primaryForm: item.primaryForm || slug,
    level: item.level,
    reviewStatus: item.reviewStatus,
    completeness: item.completeness.percent,
    missing: false,
  };
}

export function buildNeighborhood(
  index: CurriculumIndex,
  type: ContentType,
  slug: string,
  depth: number,
): { nodes: GraphNode[]; edges: GraphEdgeOut[] } {
  const centerKey = itemKey(type, slug);
  const refByKey = new Map<string, { type: ContentType; slug: string }>();
  refByKey.set(centerKey, { type, slug });

  let frontier = new Set([centerKey]);
  for (let d = 0; d < depth && frontier.size > 0; d++) {
    const next = new Map<string, { type: ContentType; slug: string }>();
    for (const edge of index.edges) {
      const fromType = edge.from_type as ContentType;
      const toType = edge.to_type as ContentType;
      const fromKey = itemKey(fromType, edge.from_slug);
      const toKey = itemKey(toType, edge.to_slug);
      if (frontier.has(fromKey) && !refByKey.has(toKey)) {
        next.set(toKey, { type: toType, slug: edge.to_slug });
      }
      if (frontier.has(toKey) && !refByKey.has(fromKey)) {
        next.set(fromKey, { type: fromType, slug: edge.from_slug });
      }
    }
    for (const [key, ref] of next) refByKey.set(key, ref);
    frontier = new Set(next.keys());
  }

  const nodes = [...refByKey.entries()].map(([key, ref]) =>
    nodeFromItem(ref.type, ref.slug, index.bySlug.get(key)),
  );

  const edges = collectInducedEdges(index.edges, refByKey);

  return { nodes, edges };
}

export function buildLevelGraph(
  index: CurriculumIndex,
  level: JlptLevel,
): { nodes: GraphNode[]; edges: GraphEdgeOut[] } {
  const refByKey = new Map<string, { type: ContentType; slug: string }>();
  for (const item of index.items) {
    if (item.level !== level) continue;
    refByKey.set(itemKey(item.type, item.slug), { type: item.type, slug: item.slug });
  }

  const nodes = [...refByKey.entries()].map(([key, ref]) =>
    nodeFromItem(ref.type, ref.slug, index.bySlug.get(key)),
  );

  const edges = collectInducedEdges(index.edges, refByKey);

  return { nodes, edges };
}

function collectInducedEdges(
  edges: DependencyEdge[],
  refByKey: Map<string, { type: ContentType; slug: string }>,
): GraphEdgeOut[] {
  const result: GraphEdgeOut[] = [];
  for (const edge of edges) {
    const fromType = edge.from_type as ContentType;
    const toType = edge.to_type as ContentType;
    const fromKey = itemKey(fromType, edge.from_slug);
    const toKey = itemKey(toType, edge.to_slug);
    if (refByKey.has(fromKey) && refByKey.has(toKey)) {
      result.push({
        fromType,
        fromSlug: edge.from_slug,
        toType,
        toSlug: edge.to_slug,
        relationship: edge.relationship_type,
      });
    }
  }
  return result;
}

export function buildGraphSummary(index: CurriculumIndex): GraphSummary {
  const edgeTypeCounts = new Map<string, GraphEdgeTypeCount>();
  const connected = new Set<string>();
  const dangling: GraphDanglingEdge[] = [];

  for (const edge of index.edges) {
    const fromType = edge.from_type as ContentType;
    const toType = edge.to_type as ContentType;
    const countKey = `${fromType}>${toType}>${edge.relationship_type}`;
    const existing = edgeTypeCounts.get(countKey);
    if (existing) {
      existing.count += 1;
    } else {
      edgeTypeCounts.set(countKey, {
        fromType,
        toType,
        relationship: edge.relationship_type,
        count: 1,
      });
    }

    const fromKey = itemKey(fromType, edge.from_slug);
    const toKey = itemKey(toType, edge.to_slug);
    connected.add(fromKey);
    connected.add(toKey);

    const fromMissing = !index.bySlug.has(fromKey);
    const toMissing = !index.bySlug.has(toKey);
    if (fromMissing || toMissing) {
      dangling.push({
        fromType: edge.from_type,
        fromSlug: edge.from_slug,
        toType: edge.to_type,
        toSlug: edge.to_slug,
        relationship: edge.relationship_type,
        missingSide: fromMissing && toMissing ? 'both' : fromMissing ? 'from' : 'to',
      });
    }
  }

  const orphans: GraphOrphan[] = index.items
    .filter(
      (item) =>
        GRAPH_TYPES.includes(item.type) && !connected.has(itemKey(item.type, item.slug)),
    )
    .map((item) => ({
      type: item.type,
      slug: item.slug,
      primaryForm: item.primaryForm,
      level: item.level,
    }));

  return {
    totalEdges: index.edges.length,
    edgeTypeCounts: [...edgeTypeCounts.values()],
    orphans,
    dangling,
  };
}

export function buildBuildOrder(
  index: CurriculumIndex,
  level?: JlptLevel,
): BuildOrderRow[] {
  const outDegree = new Map<string, number>();
  for (const edge of index.edges) {
    const fromKey = itemKey(edge.from_type as ContentType, edge.from_slug);
    outDegree.set(fromKey, (outDegree.get(fromKey) ?? 0) + 1);
  }

  const incomingPrereqs = new Map<string, DependencyEdge[]>();
  for (const edge of index.edges) {
    if (!PREREQUISITE_RELATIONSHIPS.has(edge.relationship_type)) continue;
    const toKey = itemKey(edge.to_type as ContentType, edge.to_slug);
    const list = incomingPrereqs.get(toKey);
    if (list) list.push(edge);
    else incomingPrereqs.set(toKey, [edge]);
  }

  const rows: BuildOrderRow[] = [];

  for (const item of index.items) {
    if (level && item.level !== level) continue;
    const key = itemKey(item.type, item.slug);
    const prereqs = incomingPrereqs.get(key);
    if (!prereqs || prereqs.length === 0) continue;

    const blockedBy: BuildOrderBlocker[] = [];
    for (const edge of prereqs) {
      const fromType = edge.from_type as ContentType;
      const prereqItem = index.bySlug.get(itemKey(fromType, edge.from_slug));
      const reasons: BuildOrderReason[] = [];
      if (!prereqItem) {
        reasons.push('missing');
      } else {
        if (prereqItem.reviewStatus === 'draft') reasons.push('draft');
        if (isSkeleton(prereqItem)) reasons.push('skeleton');
      }
      if (reasons.length > 0) {
        blockedBy.push({
          type: prereqItem ? fromType : null,
          slug: edge.from_slug,
          primaryForm: prereqItem?.primaryForm ?? null,
          relationship: edge.relationship_type,
          reasons,
        });
      }
    }

    if (blockedBy.length > 0) {
      rows.push({
        type: item.type,
        slug: item.slug,
        primaryForm: item.primaryForm,
        level: item.level,
        outDegree: outDegree.get(key) ?? 0,
        blockedBy,
      });
    }
  }

  rows.sort((a, b) => b.outDegree - a.outDegree || a.slug.localeCompare(b.slug));
  return rows;
}
