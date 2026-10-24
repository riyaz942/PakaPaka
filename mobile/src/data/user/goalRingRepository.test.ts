import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { DAILY_LESSON_ITEMS_BY_INTENSITY } from '@/config/constants';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration008CognitiveLoadHistory } from '@/data/migrations/008_cognitive_load_history';
import { migration013DailyLessonLog } from '@/data/migrations/013_daily_lesson_log';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { addDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { resolveDailyGoalTarget } from '@/data/user/goalRingRepository';
import { setSessionIntensity } from '@/data/user/preferencesRepository';

const mockCountServableDueItems = jest.fn();

jest.mock('@/data/reviewEligibility', () => ({
  countServableDueItems: (...args: unknown[]) => mockCountServableDueItems(...args),
}));

const mockBuildLessonPlan = jest.fn();

jest.mock('@/data/lessonPlan', () => ({
  buildLessonPlan: (...args: unknown[]) => mockBuildLessonPlan(...args),
}));

const mockComputeDailyGoalTarget = jest.fn();

jest.mock('@/core/cognitive-load/thresholdCalculator', () => {
  const actual = jest.requireActual('@/core/cognitive-load/thresholdCalculator');
  return {
    ...actual,
    computeDailyGoalTarget: (input: unknown) => {
      mockComputeDailyGoalTarget(input);
      return actual.computeDailyGoalTarget(input);
    },
  };
});

/** A plan with as many items as asked for — every remaining slot is learnable. */
function fullPlan(_cur: unknown, _user: unknown, options: { sizeOverride: number }) {
  return { items: Array.from({ length: options.sizeOverride }, (_, i) => ({ id: String(i) })) };
}

describe('resolveDailyGoalTarget', () => {
  beforeEach(() => {
    __mockResetSqlite();
    mockCountServableDueItems.mockReturnValue(0);
    mockBuildLessonPlan.mockReset();
    mockBuildLessonPlan.mockImplementation(fullPlan);
    mockComputeDailyGoalTarget.mockReset();
  });

  async function createDbs() {
    const userDb = await openDatabaseAsync('user.db');
    const curriculumDb = await openDatabaseAsync('curriculum.db');
    const migrationResult = runMigrations(userDb, [
      migration001Initial,
      migration008CognitiveLoadHistory,
      migration013DailyLessonLog,
    ]);
    expect(migrationResult.ok).toBe(true);
    return { curriculumDb, userDb };
  }

  function logLessons(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>, count: number) {
    userDb.runSync(
      'INSERT INTO daily_lesson_log (date, items_started) VALUES (?, ?)',
      todayKey(),
      count,
    );
    addDailyLoad(userDb, { date: todayKey(), increment: count, threshold: 1 });
  }

  it('is the intensity lesson allowance when no reviews are due', async () => {
    const { curriculumDb, userDb } = await createDbs();
    expect(resolveDailyGoalTarget(curriculumDb, userDb)).toBe(
      DAILY_LESSON_ITEMS_BY_INTENSITY.relaxed,
    );
    setSessionIntensity(userDb, 'immersive');
    expect(resolveDailyGoalTarget(curriculumDb, userDb)).toBe(
      DAILY_LESSON_ITEMS_BY_INTENSITY.immersive,
    );
  });

  it('adds reviews still due, with no cap', async () => {
    const { curriculumDb, userDb } = await createDbs();
    mockCountServableDueItems.mockReturnValue(42);
    expect(resolveDailyGoalTarget(curriculumDb, userDb)).toBe(
      DAILY_LESSON_ITEMS_BY_INTENSITY.relaxed + 42,
    );
  });

  it('holds steady as reviews move from due to done', async () => {
    const { curriculumDb, userDb } = await createDbs();
    mockCountServableDueItems.mockReturnValue(10);
    const before = resolveDailyGoalTarget(curriculumDb, userDb);

    addDailyLoad(userDb, { date: todayKey(), increment: 4, threshold: before });
    mockCountServableDueItems.mockReturnValue(6);
    expect(resolveDailyGoalTarget(curriculumDb, userDb)).toBe(before);
  });

  it('does not count lessons past the allowance toward the target', async () => {
    const { curriculumDb, userDb } = await createDbs();
    logLessons(userDb, DAILY_LESSON_ITEMS_BY_INTENSITY.relaxed + 10);
    expect(resolveDailyGoalTarget(curriculumDb, userDb)).toBe(
      DAILY_LESSON_ITEMS_BY_INTENSITY.relaxed,
    );
  });
  it('caps the lesson part to what can be learned today', async () => {
    const { curriculumDb, userDb } = await createDbs();
    logLessons(userDb, 5);
    mockBuildLessonPlan.mockReturnValue({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });

    resolveDailyGoalTarget(curriculumDb, userDb);

    expect(mockBuildLessonPlan).toHaveBeenCalledWith(curriculumDb, userDb, {
      ignoreAllowance: true,
      sizeOverride: 10,
    });
    expect(mockComputeDailyGoalTarget).toHaveBeenCalledWith(
      expect.objectContaining({ lessonAllowanceTotal: 8 }),
    );
  });

  it('uses the full allowance without planning once it is used up', async () => {
    const { curriculumDb, userDb } = await createDbs();
    logLessons(userDb, DAILY_LESSON_ITEMS_BY_INTENSITY.relaxed);

    resolveDailyGoalTarget(curriculumDb, userDb);

    expect(mockBuildLessonPlan).not.toHaveBeenCalled();
    expect(mockComputeDailyGoalTarget).toHaveBeenCalledWith(
      expect.objectContaining({ lessonAllowanceTotal: DAILY_LESSON_ITEMS_BY_INTENSITY.relaxed }),
    );
  });
});
