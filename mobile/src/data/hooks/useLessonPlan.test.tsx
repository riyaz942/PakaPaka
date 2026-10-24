import { act, renderHook } from '@testing-library/react-native';

import { useLessonPlan } from '@/data/hooks/useLessonPlan';
import { buildLessonPlan, type LessonPlan } from '@/data/lessonPlan';

// One stable handle object: a fresh literal per render would re-fire the
// db-keyed effect forever.
jest.mock('@/data/hooks/useDatabase', () => {
  const handles = { curriculumDb: {}, userDb: {}, isReady: true, error: null };
  return { useDatabase: () => handles };
});

jest.mock('@/data/lessonPlan', () => ({
  ...jest.requireActual('@/data/lessonPlan'),
  buildLessonPlan: jest.fn(),
}));

const mockBuild = buildLessonPlan as jest.MockedFunction<typeof buildLessonPlan>;

const plan: LessonPlan = {
  items: [],
  level: 'N5',
  grammarLevel: 'N5',
  size: 5,
  allowance: { total: 15, remaining: 15 },
  capReached: false,
  waiting: true,
};

describe('useLessonPlan', () => {
  beforeEach(() => {
    mockBuild.mockReset();
    mockBuild.mockReturnValue(plan);
  });

  it('returns the built plan and passes ignoreAllowance through', () => {
    const { result } = renderHook(() => useLessonPlan({ ignoreAllowance: true }));

    expect(result.current.waiting).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mockBuild).toHaveBeenCalledWith({}, {}, { ignoreAllowance: true });
  });

  it('builds again on refetch', () => {
    const { result } = renderHook(() => useLessonPlan());
    const calls = mockBuild.mock.calls.length;

    act(() => result.current.refetch());

    expect(mockBuild.mock.calls.length).toBe(calls + 1);
  });

  it('falls back to the empty plan when building throws', () => {
    mockBuild.mockImplementation(() => {
      throw new Error('db');
    });
    const { result } = renderHook(() => useLessonPlan());

    expect(result.current.items).toEqual([]);
    expect(result.current.level).toBeNull();
    expect(result.current.waiting).toBe(false);
  });
});
