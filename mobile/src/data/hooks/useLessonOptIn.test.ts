import { act, renderHook } from '@testing-library/react-native';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import type { OptInPoolItem } from '@/data/curriculum/itemRepository';
import { useLessonOptIn } from '@/data/hooks/useLessonOptIn';
import type { StudyStatus } from '@/data/user/studyStatus.types';

let mockLevel: JLPTLevel | null = 'N5';
let mockPools = new Map<string, OptInPoolItem[]>();
let mockStatuses = new Map<string, StudyStatus>();
let mockSrsIds: string[] = [];
let mockOptInIds: string[] = [];

jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: {}, curriculumDb: {} };
  return { useDatabase: () => databases };
});

jest.mock('@/data/curriculum/itemRepository', () => ({
  getOptInPoolForItems: (_db: unknown, ids: string[]) => mockPools.get(ids[0]) ?? [],
}));

jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: () => mockStatuses,
}));

jest.mock('@/data/user/srsStateRepository', () => ({
  getSrsStatesForItems: () => new Map(mockSrsIds.map((id) => [id, {}])),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getStartingJlptLevel: () => mockLevel,
}));

jest.mock('@/data/user/lessonOptInRepository', () => ({
  listLessonOptInIds: () => mockOptInIds,
  addLessonOptIn: (_db: unknown, itemId: string) => {
    mockOptInIds = [...mockOptInIds, itemId];
  },
  removeLessonOptIn: (_db: unknown, itemId: string) => {
    mockOptInIds = mockOptInIds.filter((id) => id !== itemId);
  },
}));

function item(id: string, jlptLevel: JLPTLevel): OptInPoolItem {
  return {
    id,
    slug: `slug-${id}`,
    primaryForm: `form-${id}`,
    meaning: `meaning-${id}`,
    itemType: 'kanji',
    sortOrder: Number(id),
    jlptLevel,
  };
}

/** N5's 昨日: opting into 昨 (N3) also takes its N4 radical 乍, but not 日 (N5). */
const KINOU_CLOSURE = [item('35', 'N5'), item('2552', 'N3'), item('1091', 'N4')];

describe('useLessonOptIn', () => {
  beforeEach(() => {
    mockLevel = 'N5';
    mockPools = new Map([['2552', KINOU_CLOSURE]]);
    mockStatuses = new Map();
    mockSrsIds = [];
    mockOptInIds = [];
  });

  it('prices the offer as only the components above the learner level', () => {
    const { result } = renderHook(() => useLessonOptIn(['2552']));

    // 昨 + 乍. 日 is N5, which this learner is already being taught.
    expect(result.current.offers.get('2552')?.extraItemCount).toBe(2);
    expect(result.current.offers.get('2552')?.isOptedIn).toBe(false);
  });

  it('does not count a component the learner has already studied', () => {
    mockStatuses = new Map([['1091', 'known']]);

    const { result } = renderHook(() => useLessonOptIn(['2552']));

    expect(result.current.offers.get('2552')?.extraItemCount).toBe(1);
  });

  it('does not count a component an import already gave an SRS state', () => {
    mockSrsIds = ['1091'];

    const { result } = renderHook(() => useLessonOptIn(['2552']));

    expect(result.current.offers.get('2552')?.extraItemCount).toBe(1);
  });

  it('offers nothing when the learner has caught up to the whole closure', () => {
    mockLevel = 'N2';

    const { result } = renderHook(() => useLessonOptIn(['2552']));

    expect(result.current.offers.has('2552')).toBe(false);
  });

  it('still reports an existing opt-in that would now add nothing', () => {
    mockLevel = 'N2';
    mockOptInIds = ['2552'];

    const { result } = renderHook(() => useLessonOptIn(['2552']));

    expect(result.current.offers.get('2552')).toEqual({
      itemId: '2552',
      extraItemCount: 0,
      isOptedIn: true,
    });
  });

  it('toggles an opt-in on and back off', () => {
    const { result } = renderHook(() => useLessonOptIn(['2552']));

    act(() => result.current.toggle('2552'));
    expect(result.current.offers.get('2552')?.isOptedIn).toBe(true);

    act(() => result.current.toggle('2552'));
    expect(result.current.offers.get('2552')?.isOptedIn).toBe(false);
    expect(mockOptInIds).toEqual([]);
  });

  it('offers nothing for an empty item list', () => {
    const { result } = renderHook(() => useLessonOptIn([]));

    expect(result.current.offers.size).toBe(0);
  });
});
