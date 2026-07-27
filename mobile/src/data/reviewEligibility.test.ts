import type { SQLiteDatabase } from 'expo-sqlite';

import { countServableDueItems, filterServableItemIds } from './reviewEligibility';

const mockListItemSummariesByIds = jest.fn();
const mockGetRequiredParentsForItems = jest.fn();
const mockListStudyStatusesForItems = jest.fn();
const mockGetDueItemIds = jest.fn();

jest.mock('@/data/curriculum/itemRepository', () => ({
  listItemSummariesByIds: (...args: unknown[]) => mockListItemSummariesByIds(...args),
  getRequiredParentsForItems: (...args: unknown[]) => mockGetRequiredParentsForItems(...args),
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
