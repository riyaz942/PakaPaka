export type ContentType =
  | 'radical'
  | 'kanji'
  | 'vocabulary'
  | 'grammar'
  | 'reading';

/** Curriculum teaching order. N3–N1 ship as skeleton (kanji-coverage plan Phase 2). */
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

export type JlptLevel = (typeof JLPT_LEVELS)[number];

export type ReviewStatus =
  | 'draft'
  | 'reviewed'
  | 'flagged_for_rewrite'
  | 'none';

export type Completeness = {
  percent: number;
  /** Unfilled fields this item is expected to carry — the actual to-do list. */
  missing: string[];
  /** Unfilled fields it may legitimately omit; tracked, but not scored. */
  optionalMissing: string[];
};

export type SidecarMeta = {
  generator_model?: string;
  prompt_version?: string;
  review_status?: Exclude<ReviewStatus, 'none'>;
};

export type FindingSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type AuditFinding = {
  level: JlptLevel;
  check: string;
  severity: FindingSeverity;
  message: string;
  slugs: string[];
};

export type SeverityTotals = Record<FindingSeverity, number>;

export type AuditSummary = {
  lastRunAt: string | null;
  totals: SeverityTotals;
  byCheck: { check: string; totals: SeverityTotals }[];
};

export type AuditFindingSlugLink = { slug: string; type: ContentType | null };

export type AuditFindingsResponse = {
  total: number;
  findings: (AuditFinding & { links: AuditFindingSlugLink[] })[];
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
  auditSeverity: FindingSeverity | null;
  auditFindingCount: number;
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
  targets: Record<JlptLevel, LevelTargets>;
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

export type GapBucket = {
  total: number;
  /** Field name → how many items of this type/level are missing it. */
  missing: Record<string, number>;
};

export type GapsResponse = {
  byTypeLevel: Record<ContentType, Record<JlptLevel, GapBucket>>;
};

export type ItemsResponse = {
  total: number;
  items: ContentListItem[];
};

export type ItemsModelsResponse = {
  models: string[];
};

/** One pasted token. Empty `matches` = unresolved; more than one = ambiguous. */
export type SlugResolveRow = {
  input: string;
  matches: ContentListItem[];
};

export type SlugResolveResponse = {
  total: number;
  rows: SlugResolveRow[];
};

export type ItemNeighbor = {
  type: ContentType;
  slug: string;
  primaryForm: string;
  meaning: string;
};

export type ItemsNeighborsResponse = {
  total: number;
  /** 0-based index in the filtered list, or -1 if the item is not in that list. */
  index: number;
  prev: ItemNeighbor | null;
  next: ItemNeighbor | null;
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

export type ItemDetailResponse = ContentListItem & {
  raw: Record<string, unknown>;
  isSkeleton: boolean;
  dependencySummary: DependencySummary;
  auditFindings: AuditFinding[];
  lessonReviewStatus: ReviewStatus | null;
  mnemonicReviewStatus: ReviewStatus | null;
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

/** Mirrors the per-type checklists in web/server/curriculum/completeness.ts. */
export const MISSING_FIELD_OPTIONS: Record<ContentType, string[]> = {
  radical: [
    'mnemonic_text',
    'description',
    'accepted_answers',
    'visual_mnemonic_url',
  ],
  kanji: [
    'readings',
    'accepted_answers',
    'meaning_mnemonic',
    'reading_mnemonic',
    'description',
  ],
  vocabulary: [
    'furigana',
    'accepted_answers',
    'meaning_mnemonic',
    'reading_mnemonic',
    'example_sentences',
  ],
  grammar: [
    'explanation_markdown',
    'caution_notes',
    'accepted_forms',
    'cloze_variants',
    'example_sentences',
  ],
  reading: [
    'body_furigana',
    'english_translation',
    'summary_ja',
    'summary_en',
    'word_spans',
    'grammar_slugs',
    'vocabulary_slugs',
    'questions',
  ],
};

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

export type GraphNeighborhoodResponse = {
  center: { type: ContentType; slug: string };
  nodes: GraphNode[];
  edges: GraphEdgeOut[];
};

export type GraphLevelResponse = {
  level: JlptLevel;
  nodes: GraphNode[];
  edges: GraphEdgeOut[];
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

export type GraphSummaryResponse = {
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

export type PipelineRunResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

/** One Phase 4 reading seed, with its generated passage when one exists. */
export type GeneratedSeedRow = {
  seed: string;
  position: number;
  tone: string;
  topic: string;
  targetWords: [number, number];
  questionCount: number;
  requiredGrammar: string[];
  passage: Record<string, unknown> | null;
  meta?: SidecarMeta;
  wordCount: number | null;
};

export type GeneratedLevel = {
  level: JlptLevel;
  total: number;
  generated: number;
  rows: GeneratedSeedRow[];
};

export type GeneratedResponse = {
  ok: true;
  levels: GeneratedLevel[];
};
