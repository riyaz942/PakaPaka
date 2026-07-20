import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { BrowseFilters, BrowseTypeValue } from '@/core/browse/browseFilters';
import type { BrowseSearchBranches } from '@/core/browse/browseSearch';
import { computePassageUnlock, type PassageUnlockStatus } from '@/core/content/passageUnlock';
import type { SRSStageLabel } from '@/core/srs/srs.types';
import { JLPT_LEVELS, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import type { ItemType } from '@/data/curriculum/itemRepository';
import {
  getPassageLinkedItemIds,
  listAllPassages,
} from '@/data/curriculum/passageRepository';
import { CURRICULUM_ATTACH_ALIAS } from '@/data/database';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

/**
 * Unified Browse query layer (FR62–FR67).
 *
 * Everything here runs against the **user** database handle, which has
 * curriculum.db attached under the `curriculum` alias (see
 * `attachCurriculumForQuery` in database.ts). That is what lets one query join
 * curriculum content against the user's study status and SRS state instead of
 * fetching both and stitching them together in JS.
 *
 * Passage lock state is the one thing that cannot be expressed in SQL: unlock
 * is derived from `computePassageUnlock` over each passage's linked items, and
 * is deliberately never persisted. `listPassageUnlockStates` resolves it up
 * front and the resulting ids are bound into the query, so the Lock facet still
 * paginates correctly without inventing an unlock table.
 */

const C = CURRICULUM_ATTACH_ALIAS;

export type BrowseItemRow = {
  kind: 'item';
  id: string;
  jlptLevel: JLPTLevel;
  sortOrder: number;
  itemType: ItemType;
  primaryForm: string;
  meaning: string;
  studyStatus: StudyStatus;
  /** Null when the item has never entered SRS — never a placeholder stage. */
  srsStage: SRSStageLabel | null;
};

export type BrowsePassageRow = {
  kind: 'passage';
  id: string;
  jlptLevel: JLPTLevel;
  sortOrder: number;
  title: string;
  /**
   * Bilingual one-line summaries (FR66). The curriculum pipeline does not
   * compile `summary_ja` / `summary_en` yet (Story 3.2), so `summaryJa` is
   * null today and `summaryEn` falls back to the passage's English
   * translation. Row props are already shaped for the real columns.
   */
  summaryJa: string | null;
  summaryEn: string | null;
  locked: boolean;
  itemsRemainingToUnlock: number;
};

export type BrowseRowModel = BrowseItemRow | BrowsePassageRow;

export type BrowseQueryInput = {
  filters: BrowseFilters;
  search: BrowseSearchBranches | null;
  passageUnlock: ReadonlyMap<string, PassageUnlockStatus>;
};

export type BrowsePageRequest = {
  limit: number;
  offset: number;
};

export type BrowseQuery = {
  sql: string;
  params: SQLiteBindValue[];
};

type QueryFragment = {
  sql: string;
  params: SQLiteBindValue[];
};

const ITEM_TYPE_VALUES: readonly BrowseTypeValue[] = [
  'radical',
  'kanji',
  'vocabulary',
  'grammar',
];

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Escape SQLite LIKE metacharacters so `%` / `_` / `\` match literally. */
function escapeLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function likeParams(search: BrowseSearchBranches, perBranch: number): string[] {
  const params: string[] = [];
  for (const branch of search.all) {
    const pattern = `%${escapeLikeLiteral(branch)}%`;
    for (let index = 0; index < perBranch; index += 1) {
      params.push(pattern);
    }
  }
  return params;
}

/** LIKE predicate with a fixed ESCAPE so bound patterns treat `%`/`_` as literals. */
function likeClause(column: string): string {
  return `${column} LIKE ? ESCAPE '\\'`;
}

/** `CASE ... END` mapping JLPT level to an easy-first sort rank (N5 → 0). */
function levelRankExpression(column: string): string {
  const cases = JLPT_LEVELS.map((level, index) => `WHEN '${level}' THEN ${index}`).join(' ');
  return `CASE ${column} ${cases} ELSE ${JLPT_LEVELS.length} END`;
}

function selectedItemTypes(filters: BrowseFilters): ItemType[] {
  if (filters.types.length === 0) return [];
  return filters.types.filter((type): type is ItemType =>
    (ITEM_TYPE_VALUES as readonly string[]).includes(type),
  );
}

function includesPassages(filters: BrowseFilters): boolean {
  return filters.types.length === 0 || filters.types.includes('passage');
}

function includesItems(filters: BrowseFilters): boolean {
  return filters.types.length === 0 || selectedItemTypes(filters).length > 0;
}

/**
 * Passage ids matching the Lock facet. Returns `null` when the facet is
 * inactive (no constraint) and `[]` when it is active but nothing matches.
 */
function lockedScopeIds(
  filters: BrowseFilters,
  passageUnlock: ReadonlyMap<string, PassageUnlockStatus>,
): string[] | null {
  if (filters.lock.length === 0) return null;
  // Selecting both states is the same as selecting neither.
  if (filters.lock.length === 2) return null;

  const wantUnlocked = filters.lock[0] === 'unlocked';
  const ids: string[] = [];
  for (const [passageId, status] of passageUnlock) {
    if (status.unlocked === wantUnlocked) ids.push(passageId);
  }
  return ids;
}

function buildItemBranch(input: BrowseQueryInput): QueryFragment | null {
  const { filters, search } = input;
  if (!includesItems(filters)) return null;

  const conditions: string[] = [];
  const params: SQLiteBindValue[] = [];

  if (filters.levels.length > 0) {
    conditions.push(`i.jlpt_level IN (${placeholders(filters.levels.length)})`);
    params.push(...filters.levels);
  }

  const itemTypes = selectedItemTypes(filters);
  if (itemTypes.length > 0) {
    conditions.push(`i.item_type IN (${placeholders(itemTypes.length)})`);
    params.push(...itemTypes);
  }

  if (filters.performance.length > 0) {
    conditions.push(
      `COALESCE(s.status, 'not_started') IN (${placeholders(filters.performance.length)})`,
    );
    params.push(...filters.performance);
  }

  if (filters.srsStages.length > 0) {
    // No COALESCE here on purpose: an item with no SRS row has no stage, and
    // giving it a stand-in would let it match a facet the learner never earned.
    conditions.push(`r.srs_stage_label IN (${placeholders(filters.srsStages.length)})`);
    params.push(...filters.srsStages);
  }

  if (search) {
    const branchClauses = search.all.map(
      () =>
        `(${likeClause('i.primary_form')} OR ${likeClause('i.meaning')}` +
        ` OR EXISTS (SELECT 1 FROM ${C}.accepted_answers aa WHERE aa.item_id = i.id AND ${likeClause('aa.answer_text')})` +
        ` OR EXISTS (SELECT 1 FROM ${C}.kanji_readings kr WHERE kr.item_id = i.id AND ${likeClause('kr.reading')}))`,
    );
    conditions.push(`(${branchClauses.join(' OR ')})`);
    params.push(...likeParams(search, 4));
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  return {
    sql:
      `SELECT 'item' AS kind, i.id AS id, i.jlpt_level AS jlpt_level, i.sort_order AS sort_order,` +
      ` ${levelRankExpression('i.jlpt_level')} AS level_rank,` +
      ` i.item_type AS item_type, i.primary_form AS primary_form, i.meaning AS meaning,` +
      ` s.status AS study_status, r.srs_stage_label AS srs_stage,` +
      ` NULL AS title, NULL AS english_translation` +
      ` FROM ${C}.items i` +
      ` LEFT JOIN item_study_status s ON s.item_id = i.id` +
      ` LEFT JOIN srs_states r ON r.item_id = i.id` +
      where,
    params,
  };
}

function buildPassageBranch(input: BrowseQueryInput): QueryFragment | null {
  const { filters, search, passageUnlock } = input;
  if (!includesPassages(filters)) return null;

  const scopeIds = lockedScopeIds(filters, passageUnlock);
  if (scopeIds !== null && scopeIds.length === 0) return null;

  const conditions: string[] = [];
  const params: SQLiteBindValue[] = [];

  if (filters.levels.length > 0) {
    conditions.push(`p.jlpt_level IN (${placeholders(filters.levels.length)})`);
    params.push(...filters.levels);
  }

  if (scopeIds !== null) {
    conditions.push(`p.id IN (${placeholders(scopeIds.length)})`);
    params.push(...scopeIds.map(Number));
  }

  if (search) {
    const branchClauses = search.all.map(
      () => `(${likeClause('p.title')} OR ${likeClause('p.english_translation')})`,
    );
    conditions.push(`(${branchClauses.join(' OR ')})`);
    params.push(...likeParams(search, 2));
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  return {
    sql:
      `SELECT 'passage' AS kind, p.id AS id, p.jlpt_level AS jlpt_level, p.sort_order AS sort_order,` +
      ` ${levelRankExpression('p.jlpt_level')} AS level_rank,` +
      ` NULL AS item_type, NULL AS primary_form, NULL AS meaning,` +
      ` NULL AS study_status, NULL AS srs_stage,` +
      ` p.title AS title, p.english_translation AS english_translation` +
      ` FROM ${C}.reading_passages p` +
      where,
    params,
  };
}

/**
 * The unioned row set, before ordering and paging. Returns `null` when the
 * filters provably match nothing (e.g. passages-only plus a lock state no
 * passage is in), so callers can skip the round-trip.
 */
function buildBrowseUnion(input: BrowseQueryInput): QueryFragment | null {
  const branches = [buildItemBranch(input), buildPassageBranch(input)].filter(
    (branch): branch is QueryFragment => branch !== null,
  );

  if (branches.length === 0) return null;

  return {
    sql: branches.map((branch) => branch.sql).join(' UNION ALL '),
    params: branches.flatMap((branch) => branch.params),
  };
}

export function buildBrowsePageQuery(
  input: BrowseQueryInput,
  page: BrowsePageRequest,
): BrowseQuery | null {
  const union = buildBrowseUnion(input);
  if (!union) return null;

  return {
    // kind + id tie-break keeps the ordering total, so paging cannot repeat or
    // skip a row when two entries share a level and sort_order.
    sql: `${union.sql} ORDER BY level_rank ASC, sort_order ASC, kind ASC, id ASC LIMIT ? OFFSET ?`,
    params: [...union.params, page.limit, page.offset],
  };
}

export function buildBrowseCountQuery(input: BrowseQueryInput): BrowseQuery | null {
  const union = buildBrowseUnion(input);
  if (!union) return null;

  return {
    sql: `SELECT COUNT(*) AS count FROM (${union.sql})`,
    params: union.params,
  };
}

type BrowseRow = {
  kind: 'item' | 'passage';
  id: number | string;
  jlpt_level: JLPTLevel;
  sort_order: number;
  item_type: ItemType | null;
  primary_form: string | null;
  meaning: string | null;
  study_status: StudyStatus | null;
  srs_stage: SRSStageLabel | null;
  title: string | null;
  english_translation: string | null;
};

function mapRow(
  row: BrowseRow,
  passageUnlock: ReadonlyMap<string, PassageUnlockStatus>,
): BrowseRowModel {
  const id = String(row.id);

  if (row.kind === 'passage') {
    const status = passageUnlock.get(id);
    // Fail closed when unlock status is missing (e.g. unlock map failed to
    // load): treat as locked rather than showing a false "open" chip.
    return {
      kind: 'passage',
      id,
      jlptLevel: row.jlpt_level,
      sortOrder: row.sort_order,
      title: row.title ?? '',
      summaryJa: null,
      summaryEn: row.english_translation ?? null,
      locked: status ? !status.unlocked : true,
      itemsRemainingToUnlock: status?.itemsRemainingToUnlock ?? 0,
    };
  }

  // Item rows deliberately carry no lock or prerequisite field. Browse shows
  // every kanji, vocabulary and grammar point regardless of lesson eligibility
  // (FR67) — that is the BUG7 fix, and it is enforced by this shape.
  return {
    kind: 'item',
    id,
    jlptLevel: row.jlpt_level,
    sortOrder: row.sort_order,
    itemType: row.item_type as ItemType,
    primaryForm: row.primary_form ?? '',
    meaning: row.meaning ?? '',
    studyStatus: row.study_status ?? 'not_started',
    srsStage: row.srs_stage ?? null,
  };
}

export function listBrowsePage(
  userDb: SQLiteDatabase,
  input: BrowseQueryInput,
  page: BrowsePageRequest,
): BrowseRowModel[] {
  const query = buildBrowsePageQuery(input, page);
  if (!query) return [];

  const rows = userDb.getAllSync<BrowseRow>(query.sql, ...query.params);
  return rows.map((row) => mapRow(row, input.passageUnlock));
}

export function countBrowse(userDb: SQLiteDatabase, input: BrowseQueryInput): number {
  const query = buildBrowseCountQuery(input);
  if (!query) return 0;

  const row = userDb.getFirstSync<{ count: number }>(query.sql, ...query.params);
  return row?.count ?? 0;
}

/**
 * Derived unlock status for every passage (FR68), reusing the Story 2.2 helper.
 * Passages with no linked items are reported unlocked — there is nothing to
 * study toward, so gating them would be a dead end.
 */
export function listPassageUnlockStates(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
): Map<string, PassageUnlockStatus> {
  const states = new Map<string, PassageUnlockStatus>();

  for (const passage of listAllPassages(curriculumDb)) {
    const linkedIds = getPassageLinkedItemIds(curriculumDb, passage.id);

    if (linkedIds.length === 0) {
      states.set(passage.id, {
        unlocked: true,
        linkedCount: 0,
        guruOrAboveCount: 0,
        coverage: 1,
        itemsRemainingToUnlock: 0,
      });
      continue;
    }

    const stageByItemId = new Map<string, SRSStageLabel>();
    for (const [itemId, state] of getSrsStatesForItems(userDb, linkedIds)) {
      stageByItemId.set(itemId, state.srsStageLabel);
    }

    states.set(passage.id, computePassageUnlock(linkedIds, stageByItemId));
  }

  return states;
}
