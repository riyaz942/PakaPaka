export type ContentType =
  | 'radical'
  | 'kanji'
  | 'vocabulary'
  | 'grammar'
  | 'reading';

export type JlptLevel = 'N5' | 'N4';

export type ReviewStatus =
  | 'draft'
  | 'reviewed'
  | 'flagged_for_rewrite'
  | 'none';

export type SidecarMeta = {
  generator_model?: string;
  prompt_version?: string;
  review_status?: Exclude<ReviewStatus, 'none'>;
};

export type Completeness = {
  percent: number;
  /** Unfilled fields this item is expected to carry — the actual to-do list. */
  missing: string[];
  /** Unfilled fields it may legitimately omit; tracked, but not scored. */
  optionalMissing: string[];
};

export type ContentItem = {
  type: ContentType;
  level: JlptLevel;
  slug: string;
  primaryForm: string;
  meaning: string;
  sortOrder: number;
  reviewStatus: ReviewStatus;
  meta?: SidecarMeta;
  completeness: Completeness;
  raw: Record<string, unknown>;
};

export type DependencyEdge = {
  from_slug: string;
  from_type: string;
  to_slug: string;
  to_type: string;
  relationship_type: string;
};

export type CurriculumMetadata = {
  version: string;
  jlpt_levels: string[];
  description: string;
  maintainer_notes?: string;
  content_counts: {
    radicals: number;
    kanji: number;
    vocabulary: number;
    grammar: number;
    total_items: number;
    reading_passages: number;
    dependency_edges: number;
  };
};

export type LevelTargets = {
  radicals: number;
  kanji: number;
  vocabulary: number;
  grammar: number;
  readings: number;
};

export type TargetsFile = {
  N5: LevelTargets;
  N4: LevelTargets;
};

export type CurriculumIndex = {
  items: ContentItem[];
  edges: DependencyEdge[];
  metadata: CurriculumMetadata;
  bySlug: Map<string, ContentItem>;
};

export type DependencyRef = {
  type: ContentType;
  slug: string;
  primaryForm: string;
  relationship: string;
};

export type DependencySummary = {
  incoming: DependencyRef[];
  outgoing: DependencyRef[];
};

/** Map key for bySlug lookups. */
export function itemKey(type: ContentType, slug: string): string {
  return `${type}:${slug}`;
}

export const SKELETON_THRESHOLD = 0.6;

export function isSkeleton(item: ContentItem): boolean {
  return item.completeness.percent < SKELETON_THRESHOLD;
}
