import type { BackupData } from '@/core/backup/backup.types';
import {
  mergeAppendOnly,
  mergeBoosts,
  mergeCognitiveLoad,
  mergeDailyLessonLog,
  mergePassageResults,
  mergePreferences,
  mergeSingleton,
  mergeStreak,
} from '@/core/sync/mergeSpecial';

// Production cap is 1.0; the plan's boost numbers need room above it.
jest.mock('@/config/constants', () => ({
  ...jest.requireActual('@/config/constants'),
  RELATED_ITEM_BOOST_CAP: 10,
}));

type Row<K extends keyof BackupData> = BackupData[K][number];

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const T3 = '2026-11-03T00:00:00.000Z';

function passage(
  answeredAt: string,
  isCorrect: boolean,
  userAnswer = 'a',
): Row<'passagePracticeResults'> {
  return { passageId: 'p1', questionId: 'q1', isCorrect, userAnswer, answeredAt };
}

function lessonLog(itemsStarted: number, date = '2026-11-16'): Row<'dailyLessonLog'> {
  return { date, itemsStarted };
}

function load(value: number, threshold = 10, updatedAt = T1): Row<'cognitiveLoadHistory'> {
  return { date: '2026-11-16', load: value, threshold, updatedAt };
}

function day(date: string, value = 1): Row<'cognitiveLoadHistory'> {
  return { date, load: value, threshold: 10, updatedAt: T1 };
}

function boost(value: number, updatedAt = T1): Row<'relatedItemBoosts'> {
  return { item: { itemType: 'kanji', slug: 'hi' }, boost: value, updatedAt };
}

function goal(dailyGoalTarget: number | null): Row<'goalRingState'> {
  return {
    dailyGoalTarget,
    goalWeekStart: null,
    consecutiveMissWeeks: 0,
    pendingRiseTo: null,
    pendingReductionTo: null,
    updatedAt: T1,
  };
}

function streak(
  currentStreak: number,
  lastReviewDate: string | null,
  extra: Partial<Row<'streaks'>> = {},
): Row<'streaks'> {
  return {
    currentStreak,
    longestStreak: currentStreak,
    lastReviewDate,
    lastCelebratedDate: null,
    updatedAt: T1,
    ...extra,
  };
}

function pref(key: string, value: string, updatedAt = T1): Row<'userPreferences'> {
  return { key, value, updatedAt };
}

const SEEN = 'seen_unlocked_passage_ids';

describe('mergeAppendOnly', () => {
  it('append-only: union of both sides, never a conflict', () => {
    const base = [{ cardId: 'a', seenAt: T1 }];
    const cards = mergeAppendOnly(
      'cardSeen',
      base,
      [{ cardId: 'c', seenAt: T2 }],
      [
        { cardId: 'a', seenAt: T1 },
        { cardId: 'b', seenAt: T3 },
      ],
    );
    expect(cards).toEqual([
      { cardId: 'a', seenAt: T1 },
      { cardId: 'b', seenAt: T3 },
      { cardId: 'c', seenAt: T2 },
    ]);

    const anki: Row<'importMetadata'> = {
      source: 'anki',
      importedAt: T1,
      mappedCount: 3,
      unmatchedCount: 0,
    };
    const wanikani: Row<'importMetadata'> = {
      source: 'wanikani',
      importedAt: T2,
      mappedCount: 9,
      unmatchedCount: 1,
    };
    expect(mergeAppendOnly('importMetadata', null, [wanikani], [anki])).toEqual([anki, wanikani]);
  });

  it('cardSeen on both sides keeps the earlier seenAt', () => {
    expect(
      mergeAppendOnly(
        'cardSeen',
        null,
        [{ cardId: 'a', seenAt: T3 }],
        [{ cardId: 'a', seenAt: T2 }],
      ),
    ).toEqual([{ cardId: 'a', seenAt: T2 }]);
    expect(
      mergeAppendOnly('cardSeen', [], [{ cardId: 'a', seenAt: T1 }], [{ cardId: 'a', seenAt: T2 }]),
    ).toEqual([{ cardId: 'a', seenAt: T1 }]);
  });
});

describe('mergePassageResults', () => {
  it('passage: one side changed → that side', () => {
    const base = [passage(T1, false)];
    expect(mergePassageResults(base, base, [passage(T2, true)])).toEqual([passage(T2, true)]);
    expect(mergePassageResults(base, [passage(T2, true)], base)).toEqual([passage(T2, true)]);
  });

  it('passage: both changed differently → later answeredAt', () => {
    const base = [passage(T1, false)];
    expect(mergePassageResults(base, [passage(T3, false, 'x')], [passage(T2, true)])).toEqual([
      passage(T3, false, 'x'),
    ]);
    expect(mergePassageResults(null, [passage(T2, true)], [passage(T3, false, 'x')])).toEqual([
      passage(T3, false, 'x'),
    ]);
  });

  it('passage: equal answeredAt → isCorrect true wins', () => {
    expect(mergePassageResults(null, [passage(T2, false, 'z')], [passage(T2, true, 'a')])).toEqual([
      passage(T2, true, 'a'),
    ]);
    expect(mergePassageResults(null, [passage(T2, true, 'a')], [passage(T2, false, 'z')])).toEqual([
      passage(T2, true, 'a'),
    ]);
  });

  it('passage: equal answeredAt and equal isCorrect → larger userAnswer', () => {
    expect(mergePassageResults(null, [passage(T2, true, 'b')], [passage(T2, true, 'c')])).toEqual([
      passage(T2, true, 'c'),
    ]);
    expect(mergePassageResults(null, [passage(T2, false, 'c')], [passage(T2, false, 'b')])).toEqual(
      [passage(T2, false, 'c')],
    );
  });
});

describe('per-day counters', () => {
  it('per-day: base 5, local 7, remote 6 → 8', () => {
    expect(mergeDailyLessonLog([lessonLog(5)], [lessonLog(7)], [lessonLog(6)])).toEqual([
      lessonLog(8),
    ]);
    expect(mergeCognitiveLoad([load(5)], [load(7)], [load(6)])).toEqual([load(8)]);
  });

  it('per-day: row only on remote → remote value', () => {
    expect(mergeDailyLessonLog([], [], [lessonLog(4)])).toEqual([lessonLog(4)]);
    expect(mergeCognitiveLoad([], [], [load(4, 12, T2)])).toEqual([load(4, 12, T2)]);
  });

  it('per-day: no base, local 7, remote 6 → 7', () => {
    expect(mergeDailyLessonLog(null, [lessonLog(7)], [lessonLog(6)])).toEqual([lessonLog(7)]);
    expect(mergeCognitiveLoad(null, [load(7)], [load(6)])).toEqual([load(7)]);
  });

  it('threshold takes the larger', () => {
    expect(mergeCognitiveLoad([load(5, 10)], [load(7, 14)], [load(6, 12)])).toEqual([load(8, 14)]);
    expect(mergeCognitiveLoad(null, [load(7, 10)], [load(6, 12)])).toEqual([load(7, 12)]);
  });

  it('per-day updatedAt is the later', () => {
    expect(mergeCognitiveLoad([load(5, 10, T1)], [load(7, 10, T3)], [load(6, 10, T2)])).toEqual([
      load(8, 10, T3),
    ]);
    expect(mergeCognitiveLoad(null, [load(7, 10, T2)], [load(6, 10, T3)])).toEqual([
      load(7, 10, T3),
    ]);
  });

  it('per-day: second device converges', () => {
    expect(mergeDailyLessonLog([lessonLog(6)], [lessonLog(6)], [lessonLog(8)])).toEqual([
      lessonLog(8),
    ]);
    expect(mergeCognitiveLoad([load(6)], [load(6)], [load(8)])).toEqual([load(8)]);
  });

  it('per-day: a result of 0 keeps the row', () => {
    expect(mergeDailyLessonLog([lessonLog(5)], [lessonLog(5)], [])).toEqual([lessonLog(0)]);
    expect(mergeDailyLessonLog(null, [lessonLog(0)], [])).toEqual([lessonLog(0)]);
    expect(mergeCognitiveLoad([load(5)], [], [load(5, 12, T2)])).toEqual([load(0, 12, T2)]);
  });

  it('per-day: a result below 0 is clamped to 0', () => {
    expect(mergeDailyLessonLog([lessonLog(9)], [lessonLog(2)], [lessonLog(3)])).toEqual([
      lessonLog(0),
    ]);
    expect(mergeCognitiveLoad([load(9)], [load(2)], [load(3)])).toEqual([load(0)]);
  });

  it('per-day: a row deleted on both sides leaves no row; rows are sorted by date', () => {
    expect(mergeDailyLessonLog([lessonLog(5)], [], [])).toEqual([]);
    expect(mergeCognitiveLoad([load(5)], [], [])).toEqual([]);
    expect(
      mergeDailyLessonLog(null, [lessonLog(2, '2026-11-17')], [lessonLog(1, '2026-11-15')]),
    ).toEqual([lessonLog(1, '2026-11-15'), lessonLog(2, '2026-11-17')]);
  });
});

describe('mergeBoosts', () => {
  it('boost: base 1, local 3, remote 2 → 4', () => {
    expect(mergeBoosts([boost(1)], [boost(3)], [boost(2)])).toEqual([boost(4)]);
  });

  it('boost: capped at RELATED_ITEM_BOOST_CAP', () => {
    expect(mergeBoosts([boost(2)], [boost(8)], [boost(7)])).toEqual([boost(10)]);
  });

  it('boost: deleted on local, raised on remote from 2 to 5 → 3', () => {
    expect(mergeBoosts([boost(2)], [], [boost(5, T2)])).toEqual([boost(3, T2)]);
  });

  it('boost: deleted on local, unchanged on remote → no row', () => {
    expect(mergeBoosts([boost(2)], [], [boost(2)])).toEqual([]);
  });

  it('boost: one side unchanged → the other side exactly (no float drift)', () => {
    expect(mergeBoosts([boost(0.1)], [boost(0.1)], [boost(0.2)])).toEqual([boost(0.2)]);
    expect(mergeBoosts([boost(0.1)], [boost(0.2)], [boost(0.1)])).toEqual([boost(0.2)]);
  });

  it('boost: deleted on both sides with a negative base → no row, no throw', () => {
    expect(mergeBoosts([boost(-2)], [], [])).toEqual([]);
  });

  it('boost: no base → max', () => {
    expect(mergeBoosts(null, [boost(3, T3)], [boost(5, T2)])).toEqual([boost(5, T3)]);
    expect(mergeBoosts(null, [], [boost(2)])).toEqual([boost(2)]);
  });
});

describe('mergeSingleton', () => {
  it('singleton goalRingState: only remote changed → remote; only local changed → local; both changed → remote', () => {
    const base = [goal(10)];
    expect(mergeSingleton('goalRingState', base, base, [goal(12)])).toEqual([goal(12)]);
    expect(mergeSingleton('goalRingState', base, [goal(8)], base)).toEqual([goal(8)]);
    expect(mergeSingleton('goalRingState', base, [goal(8)], [goal(12)])).toEqual([goal(12)]);
    expect(mergeSingleton('goalRingState', null, [goal(8)], [goal(12)])).toEqual([goal(12)]);
    expect(mergeSingleton('goalRingState', null, [], [])).toEqual([]);
  });
});

describe('mergeStreak', () => {
  const SUN_RUN = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  const MON = '2026-11-16';
  const TUE = '2026-11-17';

  it('streak: phone Mon, web Tue without sync → current 7', () => {
    const history = [...SUN_RUN, MON, TUE].map((date) => day(date));
    const [merged] = mergeStreak([streak(6, MON)], [streak(1, TUE)], history);
    expect(merged.currentStreak).toBe(7);
    expect(merged.longestStreak).toBe(7);
    expect(merged.lastReviewDate).toBe(TUE);
  });

  it('streak: longest never goes down', () => {
    const [merged] = mergeStreak(
      [streak(2, MON, { longestStreak: 30 })],
      [streak(2, MON, { longestStreak: 4 })],
      [day('2026-11-15'), day(MON)],
    );
    expect(merged.longestStreak).toBe(30);
    expect(merged.currentStreak).toBe(2);
  });

  it('streak: gap in history ends the run', () => {
    const history = [
      day('2026-10-30'),
      day('2026-10-31'),
      day('2026-11-01'),
      day('2026-11-02', 0),
      day('2026-11-03'),
      day('2026-11-04'),
    ];
    const [merged] = mergeStreak([streak(2, '2026-11-04')], [], history);
    expect(merged.currentStreak).toBe(2);
    expect(merged.longestStreak).toBe(3);
    expect(merged.lastReviewDate).toBe('2026-11-04');
  });

  it('streak: no rows and no history → []', () => {
    expect(mergeStreak([], [], [])).toEqual([]);
    expect(mergeStreak([], [], [day(MON, 0)])).toEqual([]);
  });

  it('streak: history without a streak row on either side → row from the history', () => {
    const history = [day('2026-11-15'), { ...day(MON), updatedAt: T2 }];
    expect(mergeStreak([], [], history)).toEqual([
      {
        currentStreak: 2,
        longestStreak: 2,
        lastReviewDate: MON,
        lastCelebratedDate: null,
        updatedAt: T2,
      },
    ]);
  });

  it('streak: lastCelebratedDate is the later date', () => {
    const [merged] = mergeStreak(
      [streak(1, MON, { lastCelebratedDate: '2026-11-15', updatedAt: T3 })],
      [streak(1, MON, { lastCelebratedDate: MON, updatedAt: T2 })],
      [day(MON)],
    );
    expect(merged.lastCelebratedDate).toBe(MON);
    expect(merged.updatedAt).toBe(T3);

    const [oneSide] = mergeStreak(
      [streak(1, MON, { lastCelebratedDate: MON })],
      [streak(1, MON)],
      [day(MON)],
    );
    expect(oneSide.lastCelebratedDate).toBe(MON);
  });
});

describe('mergePreferences', () => {
  it('preferences: one side changed → that value', () => {
    const base = [pref('session_intensity', 'normal'), pref('home_layout', 'a')];
    const result = mergePreferences(
      base,
      [pref('session_intensity', 'normal'), pref('home_layout', 'b', T2)],
      [pref('session_intensity', 'light', T2), pref('home_layout', 'a')],
    );
    expect(result).toEqual({
      rows: [pref('home_layout', 'b', T2), pref('session_intensity', 'light', T2)],
      conflicts: [],
    });
  });

  it('preferences: both changed differently → conflict entry', () => {
    const local = pref('session_intensity', 'heavy', T2);
    const remote = pref('session_intensity', 'light', T3);
    const result = mergePreferences(
      [pref('session_intensity', 'normal'), pref('home_layout', 'a')],
      [local, pref('home_layout', 'a')],
      [remote, pref('home_layout', 'a')],
    );
    expect(result).toEqual({
      rows: [pref('home_layout', 'a')],
      conflicts: [{ key: 'session_intensity', local, remote }],
    });
  });

  it('preferences: both set the same value → no conflict', () => {
    const result = mergePreferences(
      [pref('session_intensity', 'normal')],
      [pref('session_intensity', 'light', T2)],
      [pref('session_intensity', 'light', T3)],
    );
    expect(result.conflicts).toEqual([]);
    expect(result.rows.map((row) => row.value)).toEqual(['light']);
  });

  it('seen_unlocked_passage_ids: both changed → sorted union, no conflict', () => {
    const result = mergePreferences(
      [pref(SEEN, '["p2"]')],
      [pref(SEEN, '["p2","p9"]', T3)],
      [pref(SEEN, '["p2","p1"]', T2)],
    );
    expect(result).toEqual({
      rows: [pref(SEEN, JSON.stringify(['p1', 'p2', 'p9']), T3)],
      conflicts: [],
    });
  });

  it('seen_unlocked_passage_ids: bad JSON on one side → conflict', () => {
    const local = pref(SEEN, '["p2",', T2);
    const remote = pref(SEEN, '["p2","p1"]', T3);
    expect(mergePreferences([pref(SEEN, '["p2"]')], [local], [remote])).toEqual({
      rows: [],
      conflicts: [{ key: SEEN, local, remote }],
    });
    const notStrings = pref(SEEN, '[1,2]', T2);
    expect(mergePreferences([pref(SEEN, '["p2"]')], [notStrings], [remote]).conflicts).toEqual([
      { key: SEEN, local: notStrings, remote },
    ]);
  });
});
