import { renderHook } from '@testing-library/react-native';

import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';
import { useComponentParents } from '@/data/hooks/useComponentParents';
import type { StudyStatus } from '@/data/user/studyStatus.types';

let mockParents: CurriculumParentItem[] = [];
let mockStatuses = new Map<string, StudyStatus>();

jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: {}, curriculumDb: {} };
  return { useDatabase: () => databases };
});

jest.mock('@/data/curriculum/itemRepository', () => ({
  getComponentParentsForItem: () => mockParents,
}));

jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  listStudyStatusesForItems: () => mockStatuses,
}));

/** N5's 日記: 日 is taught at N5 and gates the word, 記 is banded N3. */
const nikki: CurriculumParentItem[] = [
  { id: '1', primaryForm: '日', itemType: 'kanji', meaning: 'day', inBand: true },
  { id: '2', primaryForm: '記', itemType: 'kanji', meaning: 'record', inBand: false },
];

describe('useComponentParents', () => {
  beforeEach(() => {
    mockParents = nikki;
    mockStatuses = new Map();
  });

  it('marks an out-of-band component the learner has no record for', () => {
    const { result } = renderHook(() => useComponentParents('10', 'vocabulary'));

    expect(result.current.map((parent) => parent.notYetLearned)).toEqual([false, true]);
  });

  it('unmarks it once the learner has actually studied it', () => {
    mockStatuses = new Map([['2', 'in_progress']]);

    const { result } = renderHook(() => useComponentParents('10', 'vocabulary'));

    expect(result.current.map((parent) => parent.notYetLearned)).toEqual([false, false]);
  });

  it('never marks an in-band component, studied or not', () => {
    mockParents = [nikki[0]];

    const { result } = renderHook(() => useComponentParents('10', 'vocabulary'));

    expect(result.current[0].notYetLearned).toBe(false);
  });
});
