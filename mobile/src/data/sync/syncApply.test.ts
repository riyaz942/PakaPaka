import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { SYNC_TABLE_KEYS, type SyncTableKey } from '@/core/sync/sync.types';
import { emptySyncData } from '@/core/sync/syncSamples.testutil';
import { rowKey, SYNC_TABLES, type SyncRow } from '@/core/sync/syncTables';
import { subscribeFuriganaOverrides } from '@/data/user/furiganaOverrideEvents';
import { applySyncMerge } from '@/data/sync/syncApply';
import { readSyncBase } from '@/data/sync/syncBaseStore';
import { readCurriculumLookup, readUserTables, type CurriculumLookup } from '@/data/sync/syncSnapshot';
import { openTestUserDb, seedCurriculum, type TestDb } from '@/test-support/sqliteTestDb';

const NEKO: ItemRef = { itemType: 'vocabulary', slug: 'neko' };
const INU: ItemRef = { itemType: 'vocabulary', slug: 'inu' };
const HI: ItemRef = { itemType: 'kanji', slug: 'hi' };
const UNKNOWN: ItemRef = { itemType: 'vocabulary', slug: 'not-in-this-curriculum' };

/**
 * One row per table. `k` sets the row key (and the timestamps, which the same-row compare ignores);
 * `v` sets the content. Singleton tables have one key, so `union` keeps the first part's row.
 */
function sample(item: ItemRef, k: number, v: number): BackupData {
  const at = `2026-11-0${k}T00:00:00.000Z`;
  const date = `2026-11-0${k}`;
  return {
    userPreferences: [{ key: `pref_${k}`, value: `value ${v}`, updatedAt: at }],
    itemStudyStatus: [{ item, status: v === 1 ? 'in_progress' : 'known', updatedAt: at }],
    srsStates: [
      {
        item,
        stability: v + 0.5,
        difficulty: 5,
        dueDate: at,
        fsrsState: 'review',
        reps: v,
        lapses: 0,
        learningSteps: 0,
        isBurned: v > 1,
        srsStageLabel: `Apprentice ${v}`,
        lastReviewedAt: v > 1 ? at : null,
        updatedAt: at,
      },
    ],
    importMetadata: [{ source: 'anki', importedAt: at, mappedCount: k, unmatchedCount: 0 }],
    personalMnemonics: [{ item, mnemonicText: `mnemonic ${v}`, updatedAt: at }],
    relatedItemBoosts: [{ item, boost: v / 10, updatedAt: at }],
    weaknessStats: [
      {
        item,
        correctCount: v,
        incorrectCount: 1,
        typoCount: 0,
        lastErrorAt: null,
        lastErrorType: v > 1 ? 'meaning' : null,
        patternTags: null,
        updatedAt: at,
      },
    ],
    cognitiveLoadHistory: [{ date, load: v * 10, threshold: 40, updatedAt: at }],
    streaks: [
      { currentStreak: v, longestStreak: 5, lastReviewDate: date, lastCelebratedDate: null, updatedAt: at },
    ],
    userSynonyms: [{ item, answerType: 'meaning', answerText: `synonym ${k}`, createdAt: at }],
    dailyLessonLog: [{ date, itemsStarted: v * 3 }],
    goalRingState: [
      {
        dailyGoalTarget: v * 10,
        goalWeekStart: null,
        consecutiveMissWeeks: 0,
        pendingRiseTo: null,
        pendingReductionTo: null,
        updatedAt: at,
      },
    ],
    furiganaOverrides: [{ item, displayMode: v === 1 ? 'shown' : 'hidden', updatedAt: at }],
    cardSeen: [{ cardId: `card ${k}`, seenAt: at }],
    passagePracticeResults: [
      { passageId: '7', questionId: String(20 + k), isCorrect: v === 1, userAnswer: `answer ${v}`, answeredAt: at },
    ],
    grammarAnswers: [{ item, sentenceKey: `sentence ${k}`, answerText: `answer ${k}`, createdAt: at }],
    grammarSentenceHistory: [{ item, sentenceKeys: [`sentence ${v}`], updatedAt: at }],
    lessonOptIns: [{ item, optedInAt: at }],
    aiSessions: [],
    aiMessages: [],
  };
}

function union(...parts: BackupData[]): BackupData {
  const data = emptySyncData();
  for (const table of SYNC_TABLE_KEYS) {
    const kind = SYNC_TABLES[table].kind;
    const rows = parts.flatMap((part) => part[table] as SyncRow<SyncTableKey>[]);
    (data as Record<SyncTableKey, unknown[]>)[table] = kind === 'singleton' ? rows.slice(0, 1) : rows;
  }
  return data;
}

/** Each table sorted by row key, so two reads compare without regard to row order. */
function sorted(data: BackupData): BackupData {
  const copy = { ...data };
  for (const table of SYNC_TABLE_KEYS) {
    (copy as Record<SyncTableKey, unknown[]>)[table] = [...(data[table] as SyncRow<SyncTableKey>[])].sort(
      (a, b) => (rowKey(table, a) < rowKey(table, b) ? -1 : 1),
    );
  }
  return copy;
}

/** Start state: two rows per table (one for NEKO, one for INU). */
const START = union(sample(NEKO, 1, 1), sample(INU, 2, 1));

async function openStartDb(): Promise<{ db: TestDb; lookup: CurriculumLookup }> {
  const db = await openTestUserDb();
  await seedCurriculum(db, {
    items: [
      [1, NEKO],
      [2, INU],
      [3, HI],
    ],
    questions: [
      [7, 21],
      [7, 22],
      [7, 23],
    ],
    version: '31',
  });
  const lookup = await readCurriculumLookup(db);
  const seeded = await applySyncMerge(db, {
    expectedLocal: emptySyncData(),
    merged: START,
    lookup,
    base: { revision: 1, data: START, carried: {} },
  });
  expect(seeded.ok).toBe(true);
  expect(sorted(await readUserTables(db, lookup))).toEqual(sorted(START));
  return { db, lookup };
}

describe('applySyncMerge', () => {
  it('applySyncMerge writes upserts and deletes for every table', async () => {
    const { db, lookup } = await openStartDb();
    // NEKO's row changes, INU's row goes, HI's row is new. Import history is append-only.
    const merged = union(sample(NEKO, 1, 2), sample(HI, 3, 1));
    merged.importMetadata = [...START.importMetadata, ...sample(HI, 3, 1).importMetadata];

    const result = await applySyncMerge(db, {
      expectedLocal: START,
      merged,
      lookup,
      base: { revision: 2, data: merged, carried: {} },
    });

    expect(result.ok).toBe(true);
    expect(sorted(await readUserTables(db, lookup))).toEqual(sorted(merged));
  });

  it('applySyncMerge writes the base in the same transaction', async () => {
    const { db, lookup } = await openStartDb();
    const merged = union(sample(NEKO, 1, 2));
    const carried = { cardSeen: ['card 9'] };

    const result = await applySyncMerge(db, {
      expectedLocal: START,
      merged,
      lookup,
      base: { revision: 5, data: merged, carried },
    });

    expect(result.ok).toBe(true);
    expect(await readSyncBase(db)).toEqual({
      ok: true,
      value: { revision: 5, data: merged, pendingReplace: false, carried },
    });
  });

  it('apply stops when local changed after the snapshot', async () => {
    const { db, lookup } = await openStartDb();
    const snapshot = await readUserTables(db, lookup);
    const baseBefore = await db.getAllAsync('SELECT * FROM sync_base');
    await db.runAsync('UPDATE srs_states SET reps = 99 WHERE item_id = 1');

    const result = await applySyncMerge(db, {
      expectedLocal: snapshot,
      merged: union(sample(HI, 3, 1)),
      lookup,
      base: { revision: 9, data: emptySyncData(), carried: {} },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_local_changed');
    expect(await db.getFirstAsync('SELECT reps FROM srs_states WHERE item_id = 1')).toEqual({ reps: 99 });
    expect(await db.getAllAsync('SELECT item_id FROM srs_states ORDER BY item_id')).toEqual([
      { item_id: 1 },
      { item_id: 2 },
    ]);
    expect(await db.getAllAsync('SELECT * FROM sync_base')).toEqual(baseBefore);
  });

  it('a failing write rolls back every table and the base', async () => {
    const { db, lookup } = await openStartDb();
    const baseBefore = await db.getAllAsync('SELECT * FROM sync_base');
    // user_preferences is written before item_study_status, whose CHECK then fails.
    const merged = union(sample(NEKO, 1, 2), sample(HI, 3, 1));
    merged.itemStudyStatus = [
      { item: NEKO, status: 'bad' as never, updatedAt: '2026-11-01T00:00:00.000Z' },
    ];

    const result = await applySyncMerge(db, {
      expectedLocal: START,
      merged,
      lookup,
      base: { revision: 2, data: merged, carried: {} },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('sync_local_failed');
    expect(sorted(await readUserTables(db, lookup))).toEqual(sorted(START));
    expect(await db.getAllAsync('SELECT * FROM sync_base')).toEqual(baseBefore);
  });

  it('applySyncMerge does not write rows for unknown items but the base keeps them', async () => {
    const { db, lookup } = await openStartDb();
    const unknown = sample(UNKNOWN, 1, 1);
    const merged = { ...START };
    for (const table of SYNC_TABLE_KEYS) {
      const kind = SYNC_TABLES[table].kind;
      if (kind === 'per_item' || kind === 'boost') {
        (merged as Record<SyncTableKey, unknown[]>)[table] = [...START[table], ...unknown[table]];
      }
    }
    merged.passagePracticeResults = [
      ...START.passagePracticeResults,
      { passageId: '8', questionId: '80', isCorrect: true, userAnswer: 'x', answeredAt: 'then' },
    ];

    const result = await applySyncMerge(db, {
      expectedLocal: START,
      merged,
      lookup,
      base: { revision: 2, data: merged, carried: {} },
    });

    expect(result).toEqual({ ok: true, value: { changedRows: 0 } });
    expect(sorted(await readUserTables(db, lookup))).toEqual(sorted(START));
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM passage_practice_results')).toEqual({ n: 2 });
    const base = await readSyncBase(db);
    expect(base.ok && base.value?.data).toEqual(merged);
  });

  it('applySyncMerge never touches a never-synced preference', async () => {
    const { db, lookup } = await openStartDb();
    await db.runAsync(
      'INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)',
      'theme_mode',
      'dark',
      'then',
    );
    const merged = { ...START, userPreferences: [] };

    const result = await applySyncMerge(db, {
      expectedLocal: START,
      merged,
      lookup,
      base: { revision: 2, data: merged, carried: {} },
    });

    expect(result).toEqual({ ok: true, value: { changedRows: 2 } });
    expect(await db.getAllAsync('SELECT key, value FROM user_preferences')).toEqual([
      { key: 'theme_mode', value: 'dark' },
    ]);
  });

  it('applySyncMerge inserts 2,000 srs rows', async () => {
    const db = await openTestUserDb();
    const items: [number, ItemRef][] = Array.from({ length: 2000 }, (_, index) => [
      index + 1,
      { itemType: 'vocabulary', slug: `word-${index + 1}` },
    ]);
    await seedCurriculum(db, { items });
    const lookup = await readCurriculumLookup(db);
    const merged = emptySyncData();
    merged.srsStates = items.map(([, item]) => ({ ...sample(item, 1, 1).srsStates[0] }));
    const runAsync = jest.spyOn(db, 'runAsync');

    const result = await applySyncMerge(db, {
      expectedLocal: emptySyncData(),
      merged,
      lookup,
      base: { revision: 1, data: merged, carried: {} },
    });

    expect(result).toEqual({ ok: true, value: { changedRows: 2000 } });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM srs_states')).toEqual({ n: 2000 });
    // 12 columns → 75 rows per statement → 27 statements.
    const srsInserts = runAsync.mock.calls.filter(([sql]) => /INTO srs_states/.test(String(sql)));
    expect(srsInserts).toHaveLength(27);
  });

  it('notifies furigana override subscribers after a commit that changed rows', async () => {
    const { db, lookup } = await openStartDb();
    const listener = jest.fn();
    const unsubscribe = subscribeFuriganaOverrides(listener);

    await applySyncMerge(db, {
      expectedLocal: START,
      merged: START,
      lookup,
      base: { revision: 2, data: START, carried: {} },
    });
    expect(listener).not.toHaveBeenCalled();

    await applySyncMerge(db, {
      expectedLocal: START,
      merged: union(sample(NEKO, 1, 2)),
      lookup,
      base: { revision: 3, data: START, carried: {} },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('a singleton row is written with id 1 and removed when the merge drops it', async () => {
    const { db, lookup } = await openStartDb();

    const merged = { ...START, streaks: [], goalRingState: sample(NEKO, 1, 3).goalRingState };
    const result = await applySyncMerge(db, {
      expectedLocal: START,
      merged,
      lookup,
      base: { revision: 2, data: merged, carried: {} },
    });

    expect(result.ok).toBe(true);
    expect(await db.getAllAsync('SELECT id FROM streaks')).toEqual([]);
    expect(await db.getAllAsync('SELECT id, daily_goal_target FROM goal_ring_state')).toEqual([
      { id: 1, daily_goal_target: 30 },
    ]);
  });
});
