import type { SQLiteDatabase } from 'expo-sqlite';

import {
  countServableDueCards,
  countServableDueItems,
  filterServableItemIds,
} from './reviewEligibility';

const mockListItemSummariesByIds = jest.fn();
const mockGetRequiredParentsForItems = jest.fn();
const mockListStudyStatusesForItems = jest.fn();
const mockGetDueItemIds = jest.fn();
const mockGetKanjiReadings = jest.fn();
const mockGetUnlearnedKanjiForItems = jest.fn();

jest.mock('@/data/curriculum/itemRepository', () => ({
  listItemSummariesByIds: (...args: unknown[]) => mockListItemSummariesByIds(...args),
  getRequiredParentsForItems: (...args: unknown[]) => mockGetRequiredParentsForItems(...args),
  getKanjiReadings: (...args: unknown[]) => mockGetKanjiReadings(...args),
}));

jest.mock('@/data/user/masteryRepository', () => ({
  getUnlearnedKanjiForItems: (...args: unknown[]) => mockGetUnlearnedKanjiForItems(...args),
}));

jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: (...args: unknown[]) => mockListStudyStatusesForItems(...args),
}));

jest.mock('@/data/user/srsStateRepository', () => ({
  getDueItemIds: (...args: unknown[]) => mockGetDueItemIds(...args),
}));

const curriculumDb = {} as SQLiteDatabase;
const userDb = {} as SQLiteDatabase;

function summary(id: string) {
  return { id, slug: `item-${id}`, primaryForm: id, meaning: id, itemType: 'kanji', sortOrder: 0 };
}

/** Statuses keyed by item id; every unlisted id resolves to not_started. */
function statuses(map: Record<string, string>) {
  mockListStudyStatusesForItems.mockImplementation((_db: unknown, ids: string[]) => {
    const result = new Map<string, string>();
    for (const id of ids) {
      if (map[id]) result.set(id, map[id]);
    }
    return result;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListItemSummariesByIds.mockImplementation((_db: unknown, ids: string[]) =>
    ids.map(summary),
  );
  mockGetRequiredParentsForItems.mockReturnValue(new Map());
  statuses({});
});

describe('filterServableItemIds', () => {
  it('keeps items with a curriculum row, no parents, and no known status', () => {
    expect(filterServableItemIds(curriculumDb, userDb, ['1', '2'])).toEqual(new Set(['1', '2']));
  });

  it('returns an empty set without querying for an empty candidate list', () => {
    expect(filterServableItemIds(curriculumDb, userDb, [])).toEqual(new Set());
    expect(mockListItemSummariesByIds).not.toHaveBeenCalled();
  });

  it('drops items with no curriculum row (partial import / OTA removal)', () => {
    mockListItemSummariesByIds.mockReturnValue([summary('1')]);

    expect(filterServableItemIds(curriculumDb, userDb, ['1', '2'])).toEqual(new Set(['1']));
  });

  it('drops items marked known', () => {
    statuses({ '2': 'known' });

    expect(filterServableItemIds(curriculumDb, userDb, ['1', '2'])).toEqual(new Set(['1']));
  });

  it('drops locked items whose required parent has not been started', () => {
    mockGetRequiredParentsForItems.mockReturnValue(
      new Map([['2', [{ id: '9', primaryForm: '九', meaning: 'nine', itemType: 'radical' }]]]),
    );

    expect(filterServableItemIds(curriculumDb, userDb, ['1', '2'])).toEqual(new Set(['1']));
  });

  it('keeps items whose required parent is in progress', () => {
    mockGetRequiredParentsForItems.mockReturnValue(
      new Map([['2', [{ id: '9', primaryForm: '九', meaning: 'nine', itemType: 'radical' }]]]),
    );
    statuses({ '9': 'in_progress' });

    expect(filterServableItemIds(curriculumDb, userDb, ['1', '2'])).toEqual(new Set(['1', '2']));
  });
});

describe('countServableDueItems', () => {
  it('counts only the due items a session would serve', () => {
    mockGetDueItemIds.mockReturnValue(['1', '2', '3']);
    mockListItemSummariesByIds.mockReturnValue([summary('1'), summary('2')]);
    statuses({ '2': 'known' });

    expect(countServableDueItems(curriculumDb, userDb)).toBe(1);
  });

  it('is zero when nothing is due', () => {
    mockGetDueItemIds.mockReturnValue([]);

    expect(countServableDueItems(curriculumDb, userDb)).toBe(0);
  });
});

describe('countServableDueCards', () => {
  type Row = { id: string; itemType: string; primaryForm: string };
  const row = (id: string, itemType: string, primaryForm: string): Row => ({
    id,
    itemType,
    primaryForm,
  });

  it('counts the cards the session header counts: two-card items count twice', () => {
    const rows = [
      row('1', 'kanji', '水'), // on'yomi → meaning + reading
      row('2', 'kanji', '乙'), // no on'yomi → meaning only
      row('3', 'vocabulary', '水曜日'), // every kanji learned → meaning + reading
      row('4', 'vocabulary', '曜日'), // a kanji not learned yet → meaning only
      row('5', 'vocabulary', 'これ'), // kana only → meaning only
      row('6', 'grammar', 'たことがある'), // Read + Build
      row('7', 'radical', '氵'),
    ];
    mockGetDueItemIds.mockReturnValue(rows.map((r) => r.id));
    mockListItemSummariesByIds.mockImplementation((_db: unknown, ids: string[]) =>
      rows.filter((r) => ids.includes(r.id)),
    );
    mockGetKanjiReadings.mockImplementation((_db: unknown, id: string) =>
      id === '1'
        ? [{ readingType: 'onyomi', reading: 'すい' }]
        : [{ readingType: 'kunyomi', reading: 'おつ' }],
    );
    mockGetUnlearnedKanjiForItems.mockReturnValue(new Map([['4', ['曜']]]));

    expect(countServableDueCards(curriculumDb, userDb)).toBe(2 + 1 + 2 + 1 + 1 + 2 + 1);
  });

  it('skips items the session would not serve', () => {
    mockGetDueItemIds.mockReturnValue(['1', '2']);
    mockListItemSummariesByIds.mockImplementation((_db: unknown, ids: string[]) =>
      [row('1', 'grammar', 'て'), row('2', 'grammar', 'に')].filter((r) => ids.includes(r.id)),
    );
    mockGetUnlearnedKanjiForItems.mockReturnValue(new Map());
    statuses({ '2': 'known' });

    expect(countServableDueCards(curriculumDb, userDb)).toBe(2);
  });

  it('is zero when nothing is due', () => {
    mockGetDueItemIds.mockReturnValue([]);

    expect(countServableDueCards(curriculumDb, userDb)).toBe(0);
  });
});
