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

export type Completeness = {
  percent: number;
  missing: string[];
};

export type SidecarMeta = {
  generator_model?: string;
  prompt_version?: string;
  review_status?: Exclude<ReviewStatus, 'none'>;
};

export type ContentListItem = {
  type: ContentType;
  level: JlptLevel;
  slug: string;
  primaryForm: string;
  meaning: string;
  sortOrder: number;
  reviewStatus: ReviewStatus;
  meta?: SidecarMeta;
  completeness: Completeness;
};

export type OverviewBucket = {
  total: number;
  status: Record<ReviewStatus, number>;
  meanCompleteness: number;
  skeletonCount: number;
  target: number;
  remaining: number;
};

export type LevelTargets = {
  radicals: number;
  kanji: number;
  vocabulary: number;
  grammar: number;
  readings: number;
};

export type OverviewResponse = {
  metadata: {
    version: string;
    jlpt_levels: string[];
    description: string;
    content_counts: Record<string, number>;
  };
  targets: { N5: LevelTargets; N4: LevelTargets };
  byTypeLevel: Record<ContentType, Record<JlptLevel, OverviewBucket>>;
  totals: {
    radicals: number;
    kanji: number;
    vocabulary: number;
    grammar: number;
    reading_passages: number;
    total_items: number;
    dependency_edges: number;
  };
  skeletonThreshold: number;
  skeletonLabel: string;
};

export type ItemsResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: ContentListItem[];
};

export const CONTENT_TYPES: ContentType[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
  'reading',
];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  radical: 'Radicals',
  kanji: 'Kanji',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading: 'Readings',
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  flagged_for_rewrite: 'Flagged',
  none: 'None',
};
