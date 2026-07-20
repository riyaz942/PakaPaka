import type { SRSStageLabel } from '@/core/srs/srs.types';
import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import { ITEM_TYPES, type ItemType } from '@/data/curriculum/itemRepository';
import { STUDY_STATUS_VALUES, type StudyStatus } from '@/data/user/studyStatus.types';

/** Reading passages sit alongside the four item types in the Type facet. */
export type BrowseTypeValue = ItemType | 'passage';

export type BrowseLockValue = 'locked' | 'unlocked';

/**
 * Browse facets (FR64). Every facet is multi-select and an empty facet means
 * "no constraint" — never "match nothing".
 *
 * Facets that cannot apply to a row kind leave that kind unconstrained rather
 * than excluding it: Performance and SRS stage describe items, so an active
 * selection narrows items while passages still show; Lock describes passages,
 * so it narrows passages while items still show. Narrowing to one kind is what
 * the Type facet is for.
 */
export type BrowseFilters = {
  levels: JLPTLevel[];
  types: BrowseTypeValue[];
  performance: StudyStatus[];
  srsStages: SRSStageLabel[];
  lock: BrowseLockValue[];
};

export type BrowseFacetKey = keyof BrowseFilters;

export const BROWSE_FACET_KEYS: readonly BrowseFacetKey[] = [
  'levels',
  'types',
  'performance',
  'srsStages',
  'lock',
] as const;

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  levels: [],
  types: [],
  performance: [],
  srsStages: [],
  lock: [],
};

export const BROWSE_TYPE_VALUES: readonly BrowseTypeValue[] = [
  ...ITEM_TYPES,
  'passage',
] as const;

export const BROWSE_SRS_STAGES: readonly SRSStageLabel[] = [
  'apprentice',
  'guru',
  'master',
  'enlightened',
  'burned',
] as const;

export const BROWSE_LOCK_VALUES: readonly BrowseLockValue[] = ['locked', 'unlocked'] as const;

/** Facet chip title, also the pill label when a facet has no selection. */
export const BROWSE_FACET_LABELS: Record<BrowseFacetKey, string> = {
  levels: 'Level',
  types: 'Type',
  performance: 'Performance',
  srsStages: 'SRS stage',
  lock: 'Lock',
};

/** Plural noun used when a facet collapses to "3 levels" style summaries. */
const BROWSE_FACET_PLURALS: Record<BrowseFacetKey, string> = {
  levels: 'levels',
  types: 'types',
  performance: 'statuses',
  srsStages: 'stages',
  lock: 'lock states',
};

const VALUE_LABELS: Record<BrowseFacetKey, Record<string, string>> = {
  levels: Object.fromEntries(JLPT_LEVELS.map((level) => [level, level])),
  types: {
    radical: 'Radicals',
    kanji: 'Kanji',
    vocabulary: 'Vocab',
    grammar: 'Grammar',
    passage: 'Passages',
  },
  performance: {
    known: 'Known',
    in_progress: 'In progress',
    not_started: 'Not started',
  },
  srsStages: {
    apprentice: 'Apprentice',
    guru: 'Guru',
    master: 'Master',
    enlightened: 'Enlightened',
    burned: 'Burned',
  },
  lock: {
    locked: 'Locked',
    unlocked: 'Unlocked',
  },
};

/** Selectable values per facet, in display order. */
export const BROWSE_FACET_OPTIONS: Record<BrowseFacetKey, readonly string[]> = {
  levels: JLPT_LEVELS,
  types: BROWSE_TYPE_VALUES,
  performance: STUDY_STATUS_VALUES,
  srsStages: BROWSE_SRS_STAGES,
  lock: BROWSE_LOCK_VALUES,
};

export function facetValueLabel(facet: BrowseFacetKey, value: string): string {
  return VALUE_LABELS[facet][value] ?? value;
}

export function isBrowseFiltersEmpty(filters: BrowseFilters): boolean {
  return BROWSE_FACET_KEYS.every((key) => filters[key].length === 0);
}

export function countActiveFacetValues(filters: BrowseFilters): number {
  return BROWSE_FACET_KEYS.reduce((total, key) => total + filters[key].length, 0);
}

export function toggleFacetValue(
  filters: BrowseFilters,
  facet: BrowseFacetKey,
  value: string,
): BrowseFilters {
  const current = filters[facet] as readonly string[];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];

  return { ...filters, [facet]: next } as BrowseFilters;
}

export function clearFacet(filters: BrowseFilters, facet: BrowseFacetKey): BrowseFilters {
  return { ...filters, [facet]: [] } as BrowseFilters;
}

/**
 * Pill text that says what the facet is doing without needing the facet name
 * next to it: "N5", "Vocab + Grammar", "3 stages".
 */
export function summarizeFacet(facet: BrowseFacetKey, values: readonly string[]): string {
  if (values.length === 0) return BROWSE_FACET_LABELS[facet];
  if (values.length === 1) return facetValueLabel(facet, values[0]);
  if (values.length === 2) {
    return `${facetValueLabel(facet, values[0])} + ${facetValueLabel(facet, values[1])}`;
  }
  return `${values.length} ${BROWSE_FACET_PLURALS[facet]}`;
}

export type BrowseFilterPill = {
  facet: BrowseFacetKey;
  label: string;
};

/** One pill per active facet, in facet declaration order. */
export function listFilterPills(filters: BrowseFilters): BrowseFilterPill[] {
  return BROWSE_FACET_KEYS.filter((facet) => filters[facet].length > 0).map((facet) => ({
    facet,
    label: summarizeFacet(facet, filters[facet]),
  }));
}
