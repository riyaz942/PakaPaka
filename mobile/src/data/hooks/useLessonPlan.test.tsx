import { renderHook } from '@testing-library/react-native';

import type { LessonCandidate } from '@/core/lesson/lessonPlanner';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import type { CurriculumListItem, OptInPoolItem } from '@/data/curriculum/itemRepository';
import { useLessonPlan } from '@/data/hooks/useLessonPlan';

// One stable handle object: a fresh literal per render would re-fire the
// db-keyed effect forever.
jest.mock('@/data/hooks/useDatabase', () => {
  const handles = { curriculumDb: {}, userDb: {}, isReady: true, error: null };
  return { useDatabase: () => handles };
});

let mockLevelPools = new Map<JLPTLevel, CurriculumListItem[]>();
let mockOptInPool: OptInPoolItem[] = [];
let mockOptInIds: string[] = [];

jest.mock('@/data/curriculum/itemRepository', () => ({
  listLessonCandidatePool: (_db: unknown, level: JLPTLevel) => mockLevelPools.get(level) ?? [],
  getOptInPoolForItems: (_db: unknown, ids: string[]) => (ids.length > 0 ? mockOptInPool : []),
  getRequiredParentsForItems: () => new Map(),
}));

jest.mock('@/data/user/lessonOptInRepository', () => ({
  listLessonOptInIds: () => mockOptInIds,
}));

jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: () => new Map(),
}));

jest.mock('@/data/user/srsStateRepository', () => ({
  getSrsStatesForItems: () => new Map(),
  getDueSrsStates: () => [],
}));

jest.mock('@/data/user/lessonProgressRepository', () => ({
  getLessonItemsStartedOn: () => 0,
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => 'N5' as JLPTLevel,
  getLessonItemCount: () => 5,
  getDailyLessonItems: () => 15,
}));

jest.mock('@/data/user/vacationRepository', () => ({
  isVacationActive: () => false,
}));

function listItem(
  id: string,
  itemType: CurriculumListItem['itemType'],
  sortOrder: number,
): CurriculumListItem {
  return {
    id,
    slug: `slug-${id}`,
    primaryForm: `form-${id}`,
    meaning: `meaning-${id}`,
    itemType,
    sortOrder,
  };
}

function planned(items: LessonCandidate[]): string[] {
  return items.map((item) => item.id);
}

describe('useLessonPlan opt-in unlock', () => {
  beforeEach(() => {
    mockLevelPools = new Map([
      [
        'N5',
        [
          listItem('n5-r1', 'radical', 1),
          listItem('n5-k1', 'kanji', 1),
          listItem('n5-k2', 'kanji', 2),
          listItem('n5-v1', 'vocabulary', 1),
        ],
      ],
    ]);
    // 昨 (N3) and the N4 radical 乍 it is built from. `sort_order` restarts per
    // level, so both collide with N5 numbering.
    mockOptInPool = [
      { ...listItem('1091', 'radical', 70), jlptLevel: 'N4' },
      { ...listItem('2552', 'kanji', 67), jlptLevel: 'N3' },
    ];
    mockOptInIds = [];
  });

  it('offers only the level pool when nothing is opted into', () => {
    const { result } = renderHook(() => useLessonPlan());

    expect(planned(result.current.items)).not.toContain('2552');
    expect(result.current.level).toBe('N5');
  });

  it('unions the opt-in and everything it is built from into the N5 pool', () => {
    mockOptInIds = ['2552'];

    const { result } = renderHook(() => useLessonPlan());
    const ids = planned(result.current.items);

    expect(ids).toContain('2552');
    expect(ids).toContain('1091');
    // Priority is per bucket, and radicals lead each round — so the radical the
    // kanji needs is never taught after it.
    expect(ids.indexOf('1091')).toBeLessThan(ids.indexOf('2552'));
    // Ahead of the level's own items of the same type, despite a higher
    // sortOrder, because the learner asked for it.
    expect(ids.indexOf('2552')).toBeLessThan(ids.indexOf('n5-k1'));
    expect(ids.indexOf('1091')).toBeLessThan(ids.indexOf('n5-r1'));
  });

  it('does not displace the rest of the level', () => {
    mockOptInIds = ['2552'];

    const { result } = renderHook(() => useLessonPlan());

    // The relaxed batch is 5, and every N5 type still gets its floor slot.
    expect(planned(result.current.items)).toEqual(
      expect.arrayContaining(['n5-v1', 'n5-r1', 'n5-k1']),
    );
  });

  it('lists an item once when the learner has caught up to their own opt-in', () => {
    mockOptInIds = ['n5-k2'];
    mockOptInPool = [{ ...listItem('n5-k2', 'kanji', 2), jlptLevel: 'N5' }];

    const { result } = renderHook(() => useLessonPlan());

    expect(planned(result.current.items).filter((id) => id === 'n5-k2')).toHaveLength(1);
  });
});
