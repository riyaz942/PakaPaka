import type { ContentStudyStatus } from '@/core/content/content.types';
import type { LessonCandidate } from '@/core/lesson/lessonPlanner';
import type { SRSStageLabel } from '@/core/srs/srs.types';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import type {
  CurriculumListItem,
  CurriculumParentItem,
  ItemType,
  OptInPoolItem,
} from '@/data/curriculum/itemRepository';
import { buildLessonPlan } from '@/data/lessonPlan';

type FakeItem = { id: string; type: ItemType; level: JLPTLevel; sort: number };
type FakeEdge = { child: string; parent: string; type: 'requires' | 'builds_on' };

const mockState = {
  items: [] as FakeItem[],
  edges: [] as FakeEdge[],
  statuses: new Map<string, ContentStudyStatus>(),
  stages: new Map<string, SRSStageLabel>(),
  startedAt: new Map<string, string>(),
  optInIds: [] as string[],
  optInPool: [] as OptInPoolItem[],
  startedToday: 0,
  vacation: false,
  startingLevel: 'N5' as JLPTLevel,
  seeds: [] as string[],
};

function mockListItem(item: FakeItem): CurriculumListItem {
  return {
    id: item.id,
    slug: `slug-${item.id}`,
    primaryForm: `form-${item.id}`,
    meaning: `meaning-${item.id}`,
    itemType: item.type,
    sortOrder: item.sort,
  };
}

function mockParents(ids: string[], type: FakeEdge['type'], parentType?: ItemType) {
  const result = new Map<string, CurriculumParentItem[]>();
  for (const edge of mockState.edges) {
    if (edge.type !== type || !ids.includes(edge.child)) continue;
    const parent = mockState.items.find((item) => item.id === edge.parent)!;
    if (parentType && parent.type !== parentType) continue;
    const list = result.get(edge.child) ?? [];
    list.push({
      id: parent.id,
      primaryForm: `form-${parent.id}`,
      itemType: parent.type,
      meaning: `meaning-${parent.id}`,
      inBand: true,
    });
    result.set(edge.child, list);
  }
  return result;
}

const mockIsStarted = (id: string) =>
  mockState.stages.has(id) ||
  mockState.statuses.get(id) === 'in_progress' ||
  mockState.statuses.get(id) === 'known';

jest.mock('@/data/curriculum/itemRepository', () => ({
  listLessonCandidatePool: (_db: unknown, level: JLPTLevel) =>
    mockState.items.filter((item) => item.level === level).map(mockListItem),
  listItemsByLevelAndType: (_db: unknown, level: JLPTLevel, type: ItemType) =>
    mockState.items
      .filter((item) => item.level === level && item.type === type)
      .map(mockListItem),
  listItemSummariesByIds: (_db: unknown, ids: string[]) =>
    mockState.items.filter((item) => ids.includes(item.id)).map(mockListItem),
  getOptInPoolForItems: (_db: unknown, ids: string[]) =>
    ids.length > 0 ? mockState.optInPool : [],
  getRequiredParentsForItems: (_db: unknown, ids: string[]) => mockParents(ids, 'requires'),
  getRadicalComponentsForItems: (_db: unknown, ids: string[]) =>
    mockParents(ids, 'builds_on', 'radical'),
  getVocabularyWeightFacts: () => new Map(),
}));

jest.mock('@/data/user/lessonOptInRepository', () => ({
  listLessonOptInIds: () => mockState.optInIds,
}));

jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: (_db: unknown, ids: string[]) =>
    new Map(ids.flatMap((id) => (mockState.statuses.has(id) ? [[id, mockState.statuses.get(id)!]] : []))),
}));

jest.mock('@/data/user/srsStateRepository', () => ({
  getSrsStatesForItems: (_db: unknown, ids: string[]) =>
    new Map(
      ids.flatMap((id) =>
        mockState.stages.has(id)
          ? [[id, { itemId: id, srsStageLabel: mockState.stages.get(id)! }]]
          : [],
      ),
    ),
  getDueSrsStates: () => [],
}));

jest.mock('@/data/user/lessonLearnerRepository', () => ({
  countStartedOrKnownItems: (_db: unknown, ids: string[]) => ids.filter(mockIsStarted).length,
  listGrammarStarts: (_db: unknown, ids: string[]) =>
    ids
      .filter((id) => mockState.statuses.get(id) === 'in_progress')
      .map((id) => ({
        itemId: id,
        startedAt: mockState.startedAt.get(id) ?? '2026-01-01T00:00:00.000Z',
        stage: mockState.stages.get(id) ?? null,
      })),
}));

jest.mock('@/data/user/lessonProgressRepository', () => ({
  getLessonItemsStartedOn: () => mockState.startedToday,
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => mockState.startingLevel,
  getLessonItemCount: () => 5,
  getDailyLessonItems: () => 15,
}));

jest.mock('@/data/user/vacationRepository', () => ({
  isVacationActive: () => mockState.vacation,
}));

jest.mock('@/utils/seededRng', () => {
  const actual = jest.requireActual('@/utils/seededRng');
  return {
    createSeededRng: (seed: string) => {
      mockState.seeds.push(seed);
      return actual.createSeededRng(seed);
    },
  };
});

const db = {} as never;
const ids = (items: LessonCandidate[]) => items.map((item) => item.id);
const item = (id: string, type: ItemType, level: JLPTLevel, sort: number): FakeItem => ({
  id,
  type,
  level,
  sort,
});
function start(id: string, stage: SRSStageLabel = 'apprentice') {
  mockState.statuses.set(id, 'in_progress');
  mockState.stages.set(id, stage);
}

beforeEach(() => {
  mockState.items = [];
  mockState.edges = [];
  mockState.statuses = new Map();
  mockState.stages = new Map();
  mockState.startedAt = new Map();
  mockState.optInIds = [];
  mockState.optInPool = [];
  mockState.startedToday = 0;
  mockState.vacation = false;
  mockState.startingLevel = 'N5';
  mockState.seeds = [];
});

describe('buildLessonPlan opt-in unlock', () => {
  beforeEach(() => {
    mockState.items = [
      item('r1', 'radical', 'N5', 1),
      item('k1', 'kanji', 'N5', 1),
      item('k2', 'kanji', 'N5', 2),
      item('v1', 'vocabulary', 'N5', 1),
    ];
    // 昨 (N3) and the N4 radical 乍 it is built from. `sort_order` restarts per
    // level, so both collide with N5 numbering.
    mockState.optInPool = [
      { ...mockListItem(item('1091', 'radical', 'N4', 70)), jlptLevel: 'N4' },
      { ...mockListItem(item('2552', 'kanji', 'N3', 67)), jlptLevel: 'N3' },
    ];
  });

  it('offers only the level pool when nothing is opted into', () => {
    const plan = buildLessonPlan(db, db);
    expect(ids(plan.items)).not.toContain('2552');
    expect(plan.level).toBe('N5');
  });

  it('unions the opt-in and everything it is built from into the N5 pool', () => {
    mockState.optInIds = ['2552'];
    const planned = ids(buildLessonPlan(db, db).items);

    expect(planned).toContain('2552');
    expect(planned).toContain('1091');
    // The radical the kanji needs is never taught after it.
    expect(planned.indexOf('1091')).toBeLessThan(planned.indexOf('2552'));
    // Ahead of the level's own items, because the learner asked for them.
    expect(planned.indexOf('2552')).toBeLessThan(planned.indexOf('k1'));
    expect(planned.indexOf('1091')).toBeLessThan(planned.indexOf('r1'));
  });

  it('does not displace the rest of the level', () => {
    mockState.optInIds = ['2552'];
    const levelIds = ['r1', 'k1', 'k2', 'v1'];
    // The batch is 5: the two opt-ins leave three slots for the level.
    expect(ids(buildLessonPlan(db, db).items).filter((id) => levelIds.includes(id))).toHaveLength(
      3,
    );
  });

  it('lists an item once when the learner has caught up to their own opt-in', () => {
    mockState.optInIds = ['k2'];
    mockState.optInPool = [{ ...mockListItem(item('k2', 'kanji', 'N5', 2)), jlptLevel: 'N5' }];
    expect(ids(buildLessonPlan(db, db).items).filter((id) => id === 'k2')).toHaveLength(1);
  });
});

describe('buildLessonPlan levels and waves', () => {
  it('waits, without advancing, when gated items exist but none is ready', () => {
    mockState.items = [
      item('r1', 'radical', 'N5', 1),
      item('k1', 'kanji', 'N5', 1),
      item('r4', 'radical', 'N4', 1),
    ];
    mockState.edges = [{ child: 'k1', parent: 'r1', type: 'builds_on' }];
    start('r1', 'apprentice');

    const plan = buildLessonPlan(db, db);
    expect(plan.items).toEqual([]);
    expect(plan.waiting).toBe(true);
    expect(plan.level).toBe('N5');
  });

  it('advances when the level is finished', () => {
    mockState.items = [
      item('r1', 'radical', 'N5', 1),
      item('k1', 'kanji', 'N5', 1),
      item('v1', 'vocabulary', 'N5', 1),
      item('r4', 'radical', 'N4', 1),
    ];
    for (const id of ['r1', 'k1', 'v1']) start(id, 'guru');

    const plan = buildLessonPlan(db, db);
    expect(plan.level).toBe('N4');
    expect(ids(plan.items)).toEqual(['r4']);
  });

  it('keeps grammar on its own track when the level moves on', () => {
    const words = Array.from({ length: 10 }, (_, i) => item(`v${i}`, 'vocabulary', 'N5', i));
    mockState.items = [
      item('r1', 'radical', 'N5', 1),
      item('k1', 'kanji', 'N5', 1),
      ...words,
      item('g1', 'grammar', 'N5', 1),
      item('r4', 'radical', 'N4', 1),
    ];
    for (const { id } of [mockState.items[0], mockState.items[1], ...words]) start(id, 'guru');

    const plan = buildLessonPlan(db, db);
    expect(plan.level).toBe('N4');
    expect(plan.grammarLevel).toBe('N5');
    expect(ids(plan.items)).toContain('g1');
  });

  describe('lower-level parts (D3)', () => {
    beforeEach(() => {
      mockState.startingLevel = 'N4';
      mockState.items = [
        item('r5', 'radical', 'N5', 1),
        item('k5', 'kanji', 'N5', 1),
        item('rx', 'radical', 'N5', 2),
        item('kx', 'kanji', 'N5', 2),
        item('w4', 'vocabulary', 'N4', 1),
      ];
      mockState.edges = [
        { child: 'w4', parent: 'k5', type: 'requires' },
        { child: 'k5', parent: 'r5', type: 'builds_on' },
      ];
    });

    it('offers the missing radical first, and nothing else from N5', () => {
      const plan = buildLessonPlan(db, db);
      expect(ids(plan.items)).toEqual(['r5']);
      expect(plan.items[0].lowerLevelPart).toBe(true);
    });

    it('offers the kanji once its radical is at Guru', () => {
      start('r5', 'guru');
      expect(ids(buildLessonPlan(db, db).items)).toEqual(['k5']);
    });

    it('offers neither when the kanji is known', () => {
      mockState.statuses.set('k5', 'known');
      const planned = ids(buildLessonPlan(db, db).items);
      expect(planned).not.toContain('k5');
      expect(planned).not.toContain('r5');
    });
  });

  it('seeds by local day and items started today', () => {
    mockState.items = Array.from({ length: 20 }, (_, i) => item(`r${i}`, 'radical', 'N5', i));
    const now = new Date(2026, 9, 24, 9);

    const first = buildLessonPlan(db, db, { now });
    expect(mockState.seeds).toContain('2026-10-24:0');
    expect(buildLessonPlan(db, db, { now }).items).toEqual(first.items);

    mockState.seeds = [];
    mockState.startedToday = 5;
    buildLessonPlan(db, db, { now });
    expect(mockState.seeds).toContain('2026-10-24:5');
  });

  it('returns an empty plan, not waiting, when everything is finished', () => {
    mockState.items = [
      item('r1', 'radical', 'N5', 1),
      item('g1', 'grammar', 'N5', 1),
      item('r4', 'radical', 'N4', 1),
    ];
    for (const { id } of mockState.items) start(id, 'guru');

    const plan = buildLessonPlan(db, db);
    expect(plan.items).toEqual([]);
    expect(plan.waiting).toBe(false);
  });

  it('returns an empty plan on vacation', () => {
    mockState.items = [item('r1', 'radical', 'N5', 1)];
    mockState.vacation = true;

    const plan = buildLessonPlan(db, db);
    expect(plan.items).toEqual([]);
    expect(plan.level).toBeNull();
  });
});
