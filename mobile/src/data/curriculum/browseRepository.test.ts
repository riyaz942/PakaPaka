import type { SQLiteDatabase } from 'expo-sqlite';

import { EMPTY_BROWSE_FILTERS, type BrowseFilters } from '@/core/browse/browseFilters';
import { buildSearchBranches } from '@/core/browse/browseSearch';
import type { PassageUnlockStatus } from '@/core/content/passageUnlock';
import {
  buildBrowseCountQuery,
  buildBrowsePageQuery,
  countBrowse,
  listBrowsePage,
  type BrowseQueryInput,
} from '@/data/curriculum/browseRepository';

function unlock(overrides: Partial<PassageUnlockStatus> = {}): PassageUnlockStatus {
  return {
    unlocked: true,
    linkedCount: 10,
    guruOrAboveCount: 10,
    coverage: 1,
    itemsRemainingToUnlock: 0,
    ...overrides,
  };
}

function input(overrides: Partial<BrowseQueryInput> = {}): BrowseQueryInput {
  return {
    filters: EMPTY_BROWSE_FILTERS,
    search: null,
    passageUnlock: new Map(),
    ...overrides,
  };
}

function withFilters(filters: Partial<BrowseFilters>): BrowseQueryInput {
  return input({ filters: { ...EMPTY_BROWSE_FILTERS, ...filters } });
}

describe('buildBrowsePageQuery', () => {
  it('treats grammar like every other type for the No mnemonic pill', () => {
    const query = buildBrowsePageQuery(input(), { limit: 40, offset: 0 });

    expect(query?.sql).not.toContain("i.item_type = 'grammar' OR");
    expect(query?.sql).toContain('(i.mnemonic_text IS NOT NULL');
  });

  it('unions items and reading passages by default', () => {
    const query = buildBrowsePageQuery(input(), { limit: 40, offset: 0 });

    expect(query).not.toBeNull();
    expect(query?.sql).toContain('UNION ALL');
    // Both branches must select the same columns in the same order, or a
    // positional UNION silently reads a passage's title as an item's meaning.
    expect(query?.sql.match(/has_mnemonic/g)).toHaveLength(2);
    expect(query?.sql).toContain('curriculum.items');
    expect(query?.sql).toContain('curriculum.reading_passages');
  });

  it('orders JLPT easy-first with a stable kind+id tie-break so pages do not skip rows', () => {
    const query = buildBrowsePageQuery(input(), { limit: 40, offset: 0 });

    expect(query?.sql).toContain('ORDER BY level_rank ASC, sort_order ASC, kind ASC, id ASC');
    expect(query?.sql).toContain("WHEN 'N5' THEN 0");
  });

  it('binds limit and offset last', () => {
    const query = buildBrowsePageQuery(input(), { limit: 40, offset: 80 });

    expect(query?.sql).toContain('LIMIT ? OFFSET ?');
    expect(query?.params.slice(-2)).toEqual([40, 80]);
  });

  it('constrains both kinds by the level facet', () => {
    const query = buildBrowsePageQuery(withFilters({ levels: ['N5', 'N4'] }), {
      limit: 40,
      offset: 0,
    });

    expect(query?.sql).toContain('i.jlpt_level IN (?, ?)');
    expect(query?.sql).toContain('p.jlpt_level IN (?, ?)');
    expect(query?.params).toEqual(expect.arrayContaining(['N5', 'N4']));
  });

  it('drops the passage branch when the type facet excludes passages', () => {
    const query = buildBrowsePageQuery(withFilters({ types: ['kanji'] }), {
      limit: 40,
      offset: 0,
    });

    expect(query?.sql).toContain('curriculum.items');
    expect(query?.sql).not.toContain('curriculum.reading_passages');
    expect(query?.sql).not.toContain('UNION ALL');
    expect(query?.sql).toContain('i.item_type IN (?)');
  });

  it('drops the item branch when the type facet selects passages only', () => {
    const query = buildBrowsePageQuery(withFilters({ types: ['passage'] }), {
      limit: 40,
      offset: 0,
    });

    expect(query?.sql).toContain('curriculum.reading_passages');
    expect(query?.sql).not.toContain('curriculum.items');
  });

  describe('performance facet', () => {
    it('treats a missing study status row as not_started', () => {
      const query = buildBrowsePageQuery(withFilters({ performance: ['not_started'] }), {
        limit: 40,
        offset: 0,
      });

      expect(query?.sql).toContain("COALESCE(s.status, 'not_started') IN (?)");
      expect(query?.params).toContain('not_started');
    });

    it('narrows items without excluding passages', () => {
      const query = buildBrowsePageQuery(withFilters({ performance: ['known'] }), {
        limit: 40,
        offset: 0,
      });

      expect(query?.sql).toContain('curriculum.reading_passages');
      expect(query?.sql).toContain('UNION ALL');
    });
  });

  describe('SRS stage facet', () => {
    it('matches real stage labels only — items with no SRS row are not given a fake stage', () => {
      const query = buildBrowsePageQuery(withFilters({ srsStages: ['guru', 'master'] }), {
        limit: 40,
        offset: 0,
      });

      expect(query?.sql).toContain('r.srs_stage_label IN (?, ?)');
      expect(query?.sql).not.toContain('COALESCE(r.srs_stage_label');
      expect(query?.params).toEqual(expect.arrayContaining(['guru', 'master']));
    });
  });

  describe('lock facet', () => {
    it('scopes passages to the ids the unlock helper resolved, and never touches items', () => {
      const passageUnlock = new Map([
        ['1', unlock({ unlocked: false, itemsRemainingToUnlock: 3 })],
        ['2', unlock({ unlocked: true })],
      ]);

      const query = buildBrowsePageQuery(
        input({ filters: { ...EMPTY_BROWSE_FILTERS, lock: ['locked'] }, passageUnlock }),
        { limit: 40, offset: 0 },
      );

      expect(query?.sql).toContain('p.id IN (?)');
      expect(query?.params).toContain(1);
      expect(query?.params).not.toContain(2);
      // Items must remain completely unaffected by the lock facet (BUG7).
      expect(query?.sql).not.toContain('i.id IN');
    });

    it('drops the passage branch when no passage matches the lock selection', () => {
      const passageUnlock = new Map([['1', unlock({ unlocked: true })]]);

      const query = buildBrowsePageQuery(
        input({ filters: { ...EMPTY_BROWSE_FILTERS, lock: ['locked'] }, passageUnlock }),
        { limit: 40, offset: 0 },
      );

      expect(query?.sql).not.toContain('curriculum.reading_passages');
      expect(query?.sql).toContain('curriculum.items');
    });

    it('returns no query at all when lock excludes every passage and type excludes items', () => {
      const passageUnlock = new Map([['1', unlock({ unlocked: true })]]);

      const query = buildBrowsePageQuery(
        input({
          filters: { ...EMPTY_BROWSE_FILTERS, types: ['passage'], lock: ['locked'] },
          passageUnlock,
        }),
        { limit: 40, offset: 0 },
      );

      expect(query).toBeNull();
    });
  });

  describe('search fan-out', () => {
    it('ORs every branch across item forms, meanings, accepted answers and readings', () => {
      const query = buildBrowsePageQuery(
        input({ search: buildSearchBranches('nihon') }),
        { limit: 40, offset: 0 },
      );

      expect(query?.sql).toContain("i.primary_form LIKE ? ESCAPE '\\'");
      expect(query?.sql).toContain("i.meaning LIKE ? ESCAPE '\\'");
      expect(query?.sql).toContain('curriculum.accepted_answers');
      expect(query?.sql).toContain('curriculum.kanji_readings');
      expect(query?.params).toEqual(expect.arrayContaining(['%nihon%', '%にほん%', '%ニホン%']));
    });

    it('escapes LIKE wildcards in the bound patterns', () => {
      const query = buildBrowsePageQuery(
        input({ search: buildSearchBranches('100%_off') }),
        { limit: 40, offset: 0 },
      );

      expect(query?.params).toEqual(
        expect.arrayContaining(['%100\\%\\_off%']),
      );
      expect(query?.sql).toContain("ESCAPE '\\'");
    });

    it('searches passage title and english translation', () => {
      const query = buildBrowsePageQuery(
        input({ search: buildSearchBranches('market') }),
        { limit: 40, offset: 0 },
      );

      expect(query?.sql).toContain("p.title LIKE ? ESCAPE '\\'");
      expect(query?.sql).toContain("p.english_translation LIKE ? ESCAPE '\\'");
    });

    it('omits the search predicate entirely for a blank query', () => {
      const query = buildBrowsePageQuery(input({ search: buildSearchBranches('  ') }), {
        limit: 40,
        offset: 0,
      });

      expect(query?.sql).not.toContain('LIKE');
    });
  });
});

describe('buildBrowseCountQuery', () => {
  it('counts over exactly the same rows the page query selects', () => {
    const queryInput = withFilters({ levels: ['N5'], types: ['kanji', 'passage'] });

    const page = buildBrowsePageQuery(queryInput, { limit: 40, offset: 0 });
    const count = buildBrowseCountQuery(queryInput);

    // The page query is the counted subquery plus ordering and paging, so the
    // count can never drift from what the list actually returns.
    const pageBody = page!.sql.slice(0, page!.sql.indexOf('ORDER BY')).trim();
    expect(count?.sql).toContain(pageBody.slice(pageBody.indexOf('FROM')));
    expect(count?.params).toEqual(page!.params.slice(0, -2));
  });

  it('is null when the page query is null', () => {
    const queryInput = input({
      filters: { ...EMPTY_BROWSE_FILTERS, types: ['passage'], lock: ['locked'] },
      passageUnlock: new Map([['1', unlock({ unlocked: true })]]),
    });

    expect(buildBrowseCountQuery(queryInput)).toBeNull();
    expect(buildBrowsePageQuery(queryInput, { limit: 40, offset: 0 })).toBeNull();
  });
});

// The shared expo-sqlite mock has no ATTACH support (see masteryRepository.test.ts),
// so execution is verified against a stub handle that returns fixed rows.
function fakeDb(rows: Record<string, unknown>[]): SQLiteDatabase {
  return {
    getAllSync: jest.fn().mockReturnValue(rows),
    getFirstSync: jest.fn().mockReturnValue(rows[0] ?? null),
  } as unknown as SQLiteDatabase;
}

describe('listBrowsePage', () => {
  it('maps item rows without any lock or dependency field (BUG7)', () => {
    const db = fakeDb([
      {
        kind: 'item',
        id: 7,
        jlpt_level: 'N5',
        sort_order: 3,
        item_type: 'kanji',
        primary_form: '水',
        meaning: 'water',
        reading: 'みず',
        study_status: 'in_progress',
        srs_stage: 'guru',
        has_mnemonic: 1,
        title: null,
        english_translation: null,
      },
    ]);

    const [row] = listBrowsePage(db, input(), { limit: 40, offset: 0 });

    expect(row).toEqual({
      kind: 'item',
      id: '7',
      jlptLevel: 'N5',
      sortOrder: 3,
      itemType: 'kanji',
      primaryForm: '水',
      meaning: 'water',
      reading: 'みず',
      studyStatus: 'in_progress',
      srsStage: 'guru',
      hasMnemonic: true,
    });
    expect(row).not.toHaveProperty('locked');
    expect(row).not.toHaveProperty('isLocked');
  });

  it('reports a skeleton item as having no mnemonic (plan v2 Phase D)', () => {
    const db = fakeDb([
      {
        kind: 'item',
        id: 9,
        jlpt_level: 'N3',
        sort_order: 1,
        item_type: 'vocabulary',
        primary_form: '安保',
        meaning: 'security',
        reading: 'あんぽ',
        study_status: null,
        srs_stage: null,
        has_mnemonic: 0,
      },
    ]);

    const [row] = listBrowsePage(db, input(), { limit: 40, offset: 0 });

    expect(row).toMatchObject({ hasMnemonic: false });
  });

  it('defaults a missing study status to not_started and a missing SRS stage to null', () => {
    const db = fakeDb([
      {
        kind: 'item',
        id: 7,
        jlpt_level: 'N5',
        sort_order: 3,
        item_type: 'vocabulary',
        primary_form: '水',
        meaning: 'water',
        study_status: null,
        srs_stage: null,
      },
    ]);

    const [row] = listBrowsePage(db, input(), { limit: 40, offset: 0 });

    expect(row).toMatchObject({ studyStatus: 'not_started', srsStage: null });
  });

  it('carries passage lock state from the unlock helper onto the row', () => {
    const db = fakeDb([
      {
        kind: 'passage',
        id: 4,
        jlpt_level: 'N4',
        sort_order: 1,
        item_type: null,
        primary_form: null,
        meaning: null,
        study_status: null,
        srs_stage: null,
        title: 'At the market',
        english_translation: 'A short trip to the market.',
      },
    ]);

    const passageUnlock = new Map([
      ['4', unlock({ unlocked: false, itemsRemainingToUnlock: 3 })],
    ]);

    const [row] = listBrowsePage(db, input({ passageUnlock }), { limit: 40, offset: 0 });

    expect(row).toEqual({
      kind: 'passage',
      id: '4',
      jlptLevel: 'N4',
      sortOrder: 1,
      title: 'At the market',
      summaryJa: null,
      summaryEn: 'A short trip to the market.',
      locked: true,
      itemsRemainingToUnlock: 3,
    });
  });

  it('returns an empty page without querying when the filters can match nothing', () => {
    const db = fakeDb([]);
    const queryInput = input({
      filters: { ...EMPTY_BROWSE_FILTERS, types: ['passage'], lock: ['locked'] },
      passageUnlock: new Map([['1', unlock({ unlocked: true })]]),
    });

    expect(listBrowsePage(db, queryInput, { limit: 40, offset: 0 })).toEqual([]);
    expect(db.getAllSync).not.toHaveBeenCalled();
  });
});

describe('countBrowse', () => {
  it('returns the counted total', () => {
    const db = fakeDb([{ count: 137 }]);
    expect(countBrowse(db, input())).toBe(137);
  });

  it('returns zero without querying when the filters can match nothing', () => {
    const db = fakeDb([{ count: 5 }]);
    const queryInput = input({
      filters: { ...EMPTY_BROWSE_FILTERS, types: ['passage'], lock: ['locked'] },
      passageUnlock: new Map([['1', unlock({ unlocked: true })]]),
    });

    expect(countBrowse(db, queryInput)).toBe(0);
    expect(db.getFirstSync).not.toHaveBeenCalled();
  });
});
