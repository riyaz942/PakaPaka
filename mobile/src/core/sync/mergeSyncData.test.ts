import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { diffSyncData } from '@/core/sync/diffSyncData';
import {
  carriedKeysOf,
  guardedKeysOf,
  isEmptyProgress,
  mergeSyncData,
  withCarriedRows,
  withoutKeys,
} from '@/core/sync/mergeSyncData';
import type { KnownContent } from '@/core/sync/sync.types';
import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';

type Row<K extends keyof BackupData> = BackupData[K][number];

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const T3 = '2026-11-03T00:00:00.000Z';

function item(slug: string): ItemRef {
  return { itemType: 'vocabulary', slug };
}

function srs(slug: string, reps: number, updatedAt = T1): Row<'srsStates'> {
  return {
    item: item(slug),
    stability: 2.5,
    difficulty: 5,
    dueDate: T1,
    fsrsState: 'review',
    reps,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'Apprentice 2',
    lastReviewedAt: null,
    updatedAt,
  };
}

function weakness(slug: string, correctCount: number, updatedAt = T1): Row<'weaknessStats'> {
  return {
    item: item(slug),
    correctCount,
    incorrectCount: 0,
    typoCount: 0,
    lastErrorAt: null,
    lastErrorType: null,
    patternTags: null,
    updatedAt,
  };
}

function status(
  slug: string,
  value: Row<'itemStudyStatus'>['status'],
  updatedAt = T1,
): Row<'itemStudyStatus'> {
  return { item: item(slug), status: value, updatedAt };
}

function mnemonic(slug: string, mnemonicText: string, updatedAt = T1): Row<'personalMnemonics'> {
  return { item: item(slug), mnemonicText, updatedAt };
}

function synonym(slug: string, answerText: string, createdAt = T1): Row<'userSynonyms'> {
  return { item: item(slug), answerType: 'meaning', answerText, createdAt };
}

function boost(slug: string, value: number, updatedAt = T1): Row<'relatedItemBoosts'> {
  return { item: item(slug), boost: value, updatedAt };
}

function passage(
  passageId: string,
  questionId: string,
  userAnswer = 'a',
): Row<'passagePracticeResults'> {
  return { passageId, questionId, isCorrect: true, userAnswer, answeredAt: T1 };
}

function pref(key: string, value: string, updatedAt = T1): Row<'userPreferences'> {
  return { key, value, updatedAt };
}

function day(date: string, load: number): Row<'cognitiveLoadHistory'> {
  return { date, load, threshold: 10, updatedAt: T1 };
}

function streak(currentStreak: number, lastReviewDate: string): Row<'streaks'> {
  return {
    currentStreak,
    longestStreak: currentStreak,
    lastReviewDate,
    lastCelebratedDate: null,
    updatedAt: T1,
  };
}

function data(rows: Partial<BackupData>): BackupData {
  return { ...emptySyncData(), ...rows };
}

const knowsAll: KnownContent = { hasItem: () => true, hasPassageQuestion: () => true };

function knowsAllBut(unknownSlug: string): KnownContent {
  return { hasItem: (ref) => ref.slug !== unknownSlug, hasPassageQuestion: () => true };
}

/** Item `a` conflicts (srs changed on both sides); item `b` changed on remote only. */
function conflictCase(): { base: BackupData; local: BackupData; remote: BackupData } {
  const base = data({
    srsStates: [srs('a', 1), srs('b', 1)],
    weaknessStats: [weakness('a', 1)],
    itemStudyStatus: [status('a', 'in_progress')],
    personalMnemonics: [mnemonic('a', 'old')],
    userSynonyms: [synonym('a', 'cat')],
  });
  const local = data({
    srsStates: [srs('a', 2, T2), srs('b', 1)],
    weaknessStats: [weakness('a', 2, T2)],
    itemStudyStatus: [status('a', 'known', T2)],
    personalMnemonics: [mnemonic('a', 'old')],
    userSynonyms: [synonym('a', 'cat'), synonym('a', 'kitty', T2)],
  });
  const remote = data({
    srsStates: [srs('a', 3, T3), srs('b', 5, T3)],
    weaknessStats: [weakness('a', 3, T3)],
    itemStudyStatus: [status('a', 'in_progress')],
    personalMnemonics: [mnemonic('a', 'new', T3)],
    userSynonyms: [synonym('a', 'cat'), synonym('a', 'feline', T3)],
  });
  return { base, local, remote };
}

describe('withCarriedRows and mergeSyncData', () => {
  it('unknown-item rows are carried and stay in the merged file', () => {
    const base = data({
      srsStates: [srs('a', 1), srs('b', 1), srs('x', 4)],
      relatedItemBoosts: [boost('x', 0.5)],
    });
    // `b` is known and deleted on this device: it is not carried back.
    const local = withCarriedRows(data({ srsStates: [srs('a', 2)] }), base, knowsAllBut('x'), {});
    expect(local.srsStates).toEqual([srs('a', 2), srs('x', 4)]);
    expect(local.relatedItemBoosts).toEqual([boost('x', 0.5)]);

    const unchanged = mergeSyncData({ base, local, remote: base }, null);
    expect(unchanged.merged?.srsStates).toEqual([srs('a', 2), srs('x', 4)]);
    expect(unchanged.merged?.relatedItemBoosts).toEqual([boost('x', 0.5)]);

    const remote = data({
      srsStates: [srs('a', 1), srs('b', 1), srs('x', 5, T2)],
      relatedItemBoosts: [boost('x', 0.5)],
    });
    const changed = mergeSyncData({ base, local, remote }, null);
    expect(changed.merged?.srsStates).toEqual([srs('a', 2), srs('x', 5, T2)]);
  });

  it('unknown passage rows are carried', () => {
    const base = data({ passagePracticeResults: [passage('7', '1'), passage('9', '1')] });
    const known: KnownContent = {
      hasItem: () => true,
      hasPassageQuestion: (passageId, questionId) => !(passageId === '9' && questionId === '1'),
    };
    const local = withCarriedRows(
      data({ passagePracticeResults: [passage('8', '1')] }),
      base,
      known,
      {},
    );
    expect(local.passagePracticeResults).toEqual([passage('8', '1'), passage('9', '1')]);

    const { merged } = mergeSyncData({ base, local, remote: base }, null);
    expect(merged?.passagePracticeResults).toEqual([passage('8', '1'), passage('9', '1')]);
  });

  it('an unknown-item row is never a conflict', () => {
    const base = data({ srsStates: [srs('x', 4)], personalMnemonics: [mnemonic('x', 'old')] });
    const remote = data({ srsStates: [srs('x', 5, T2)], personalMnemonics: [] });
    const local = withCarriedRows(emptySyncData(), base, knowsAllBut('x'), {});

    const result = mergeSyncData({ base, local, remote }, null);
    expect(result.conflicts).toEqual([]);
    expect(result.merged?.srsStates).toEqual([srs('x', 5, T2)]);
    expect(result.merged?.personalMnemonics).toEqual([]);

    // Without the carried rows the missing local rows would read as deletions.
    expect(mergeSyncData({ base, local: emptySyncData(), remote }, null).conflicts).toHaveLength(1);
  });

  it('an item learned by a curriculum update keeps its synced rows', () => {
    // `y` was unknown when the base was written, so this device holds none of its rows.
    const base = data({
      srsStates: [srs('a', 1), srs('y', 4)],
      personalMnemonics: [mnemonic('y', 'old')],
    });
    const carried = { srsStates: ['vocabulary:y'], personalMnemonics: ['vocabulary:y'] };
    const device = data({ srsStates: [srs('a', 1)] });
    const local = withCarriedRows(device, base, knowsAll, carried);

    const result = mergeSyncData({ base, local, remote: base }, null);
    expect(result.conflicts).toEqual([]);
    expect(result.merged?.srsStates).toEqual([srs('a', 1), srs('y', 4)]);
    expect(result.merged?.personalMnemonics).toEqual([mnemonic('y', 'old')]);

    const diff = diffSyncData(device, result.merged as BackupData, knowsAll);
    expect(diff.srsStates).toEqual({ upserts: [srs('y', 4)], deletes: [] });
    expect(diff.personalMnemonics).toEqual({ upserts: [mnemonic('y', 'old')], deletes: [] });
  });

  it('a row deleted on this device is still a delete', () => {
    const base = data({ srsStates: [srs('a', 1), srs('b', 1)] });
    const device = data({ srsStates: [srs('a', 1)] });
    const local = withCarriedRows(device, base, knowsAll, { srsStates: ['vocabulary:x'] });
    expect(local.srsStates).toEqual([srs('a', 1)]);

    const { merged } = mergeSyncData({ base, local, remote: base }, null);
    expect(merged?.srsStates).toEqual([srs('a', 1)]);
  });

  it('carriedKeysOf lists unknown rows and rows the device lacks', () => {
    const baseData = data({
      srsStates: [srs('a', 1), srs('x', 1), srs('y', 1)],
      relatedItemBoosts: [boost('x', 0.5)],
      passagePracticeResults: [passage('7', '1'), passage('9', '1')],
      userPreferences: [pref('session_intensity', 'light')],
      cardSeen: [{ cardId: 'welcome', seenAt: T1 }],
    });
    const deviceData = data({
      srsStates: [srs('a', 2)],
      passagePracticeResults: [passage('7', '1')],
      userPreferences: [pref('session_intensity', 'light')],
    });
    const known: KnownContent = {
      hasItem: (ref) => ref.slug !== 'x',
      hasPassageQuestion: (passageId) => passageId !== '9',
    };

    expect(carriedKeysOf(baseData, deviceData, known)).toEqual({
      srsStates: ['vocabulary:x', 'vocabulary:y'],
      relatedItemBoosts: ['vocabulary:x'],
      passagePracticeResults: ['9|1'],
      cardSeen: ['welcome'],
    });
  });

  it('guardedKeysOf lists the carried keys the device holds', () => {
    const carried = { srsStates: ['vocabulary:x', 'vocabulary:y'], personalMnemonics: ['vocabulary:y'] };
    const deviceData = data({ srsStates: [srs('a', 1), srs('y', 1)] });

    expect(guardedKeysOf(carried, deviceData)).toEqual({ srsStates: ['vocabulary:y'] });
    expect(guardedKeysOf({}, deviceData)).toEqual({});
  });

  it('withoutKeys drops only the listed rows', () => {
    const base = data({ srsStates: [srs('a', 1), srs('y', 4)], personalMnemonics: [mnemonic('y', 'old')] });

    const result = withoutKeys(base, { srsStates: ['vocabulary:y'] });
    expect(result.srsStates).toEqual([srs('a', 1)]);
    expect(result.personalMnemonics).toEqual([mnemonic('y', 'old')]);
  });

  it('a row the device wrote for a carried item is a conflict against the guarded base', () => {
    // `y` was carried; this device then studied it and wrote its own row.
    const base = data({ srsStates: [srs('a', 1), srs('y', 4)] });
    const carried = { srsStates: ['vocabulary:y'] };
    const device = data({ srsStates: [srs('a', 1), srs('y', 1, T2)] });
    const local = withCarriedRows(device, base, knowsAll, carried);
    const mergeBase = withoutKeys(base, guardedKeysOf(carried, device));

    const result = mergeSyncData({ base: mergeBase, local, remote: base }, null);
    expect(result.conflicts).toEqual([
      { kind: 'item', item: item('y'), localUpdatedAt: T2, remoteUpdatedAt: T1 },
    ]);
    // Without the guard the device row would silently win.
    expect(mergeSyncData({ base, local, remote: base }, null).merged?.srsStates).toEqual([
      srs('a', 1),
      srs('y', 1, T2),
    ]);
  });

  it('one conflicting row puts the whole item in one entry', () => {
    const base = data({ srsStates: [srs('a', 1)], personalMnemonics: [mnemonic('a', 'old')] });
    const local = data({ srsStates: [srs('a', 2, T2)], personalMnemonics: [mnemonic('a', 'old')] });
    const remote = data({
      srsStates: [srs('a', 3, T3)],
      personalMnemonics: [mnemonic('a', 'new', T3)],
    });

    const result = mergeSyncData({ base, local, remote }, null);
    expect(result.conflicts).toEqual([
      { kind: 'item', item: item('a'), localUpdatedAt: T2, remoteUpdatedAt: T3 },
    ]);
  });

  it('choice local: every row of the item comes from local', () => {
    const input = conflictCase();
    const { merged } = mergeSyncData(input, 'local');
    expect(merged?.srsStates).toEqual([srs('a', 2, T2), srs('b', 5, T3)]);
    expect(merged?.weaknessStats).toEqual(input.local.weaknessStats);
    expect(merged?.itemStudyStatus).toEqual(input.local.itemStudyStatus);
    expect(merged?.personalMnemonics).toEqual(input.local.personalMnemonics);
    expect(merged?.userSynonyms).toEqual(input.local.userSynonyms);
  });

  it('choice remote: every row comes from remote, including a synonym only remote has, and without a synonym only local has', () => {
    const input = conflictCase();
    const { merged } = mergeSyncData(input, 'remote');
    expect(merged?.srsStates).toEqual(input.remote.srsStates);
    expect(merged?.weaknessStats).toEqual(input.remote.weaknessStats);
    expect(merged?.itemStudyStatus).toEqual(input.remote.itemStudyStatus);
    expect(merged?.personalMnemonics).toEqual(input.remote.personalMnemonics);
    expect(merged?.userSynonyms).toEqual([synonym('a', 'cat'), synonym('a', 'feline', T3)]);
  });

  it('non-conflicting items merge with no entry', () => {
    const base = data({ srsStates: [srs('a', 1), srs('b', 1)] });
    const local = data({ srsStates: [srs('a', 2, T2), srs('b', 1)] });
    const remote = data({ srsStates: [srs('a', 1), srs('b', 2, T3)] });

    const result = mergeSyncData({ base, local, remote }, null);
    expect(result.conflicts).toEqual([]);
    expect(result.merged?.srsStates).toEqual([srs('a', 2, T2), srs('b', 2, T3)]);
  });

  it('conflicts and no choice → merged is null', () => {
    const result = mergeSyncData(conflictCase(), null);
    expect(result.conflicts).toHaveLength(1);
    expect(result.merged).toBeNull();
  });

  it('preference conflict is an entry of kind preference and follows the choice', () => {
    const base = data({
      userPreferences: [pref('home_layout', 'a'), pref('session_intensity', 'standard')],
    });
    const local = data({ userPreferences: [pref('session_intensity', 'light', T2)] });
    const remote = data({
      userPreferences: [pref('home_layout', 'b', T3), pref('session_intensity', 'intense', T3)],
    });

    const result = mergeSyncData({ base, local, remote }, null);
    expect(result.merged).toBeNull();
    expect(result.conflicts).toEqual([
      { kind: 'preference', key: 'home_layout', localUpdatedAt: null, remoteUpdatedAt: T3 },
      { kind: 'preference', key: 'session_intensity', localUpdatedAt: T2, remoteUpdatedAt: T3 },
    ]);

    expect(mergeSyncData({ base, local, remote }, 'local').merged?.userPreferences).toEqual([
      pref('session_intensity', 'light', T2),
    ]);
    expect(mergeSyncData({ base, local, remote }, 'remote').merged?.userPreferences).toEqual([
      pref('home_layout', 'b', T3),
      pref('session_intensity', 'intense', T3),
    ]);
  });

  it('conflict entries list items first, then preferences, each sorted by key', () => {
    const base = data({
      srsStates: [srs('b', 1), srs('a', 1)],
      userPreferences: [pref('z', '1'), pref('y', '1')],
    });
    const local = data({
      srsStates: [srs('b', 2), srs('a', 2)],
      userPreferences: [pref('z', '2'), pref('y', '2')],
    });
    const remote = data({
      srsStates: [srs('b', 3), srs('a', 3)],
      userPreferences: [pref('z', '3'), pref('y', '3')],
    });

    const { conflicts } = mergeSyncData({ base, local, remote }, null);
    expect(conflicts.map((entry) => (entry.kind === 'item' ? entry.item.slug : entry.key))).toEqual(
      ['a', 'b', 'y', 'z'],
    );
  });

  it('boost rows of a conflicting item still use the number rule', () => {
    const input = conflictCase();
    input.base.relatedItemBoosts = [boost('a', 0.25)];
    input.local.relatedItemBoosts = [boost('a', 0.5, T2)];
    input.remote.relatedItemBoosts = [boost('a', 0.375, T3)];

    expect(mergeSyncData(input, 'local').merged?.relatedItemBoosts).toEqual([
      boost('a', 0.625, T3),
    ]);
    expect(mergeSyncData(input, 'remote').merged?.relatedItemBoosts).toEqual([
      boost('a', 0.625, T3),
    ]);
  });

  it('streak is recomputed from the merged history', () => {
    const base = data({
      cognitiveLoadHistory: [day('2026-11-01', 1)],
      streaks: [streak(1, '2026-11-01')],
    });
    const local = data({
      cognitiveLoadHistory: [day('2026-11-01', 1), day('2026-11-02', 1)],
      streaks: [streak(2, '2026-11-02')],
    });
    const remote = data({
      cognitiveLoadHistory: [day('2026-11-01', 1), day('2026-11-03', 1)],
      streaks: [streak(1, '2026-11-03')],
    });

    const { merged } = mergeSyncData({ base, local, remote }, null);
    expect(merged?.streaks).toEqual([
      {
        currentStreak: 3,
        longestStreak: 3,
        lastReviewDate: '2026-11-03',
        lastCelebratedDate: null,
        updatedAt: T1,
      },
    ]);
  });

  it('isEmptyProgress: only preferences and cardSeen → true; one srsStates row → false', () => {
    const onlySettings = data({
      userPreferences: [pref('session_intensity', 'light')],
      cardSeen: [{ cardId: 'welcome', seenAt: T1 }],
    });
    expect(isEmptyProgress(onlySettings)).toBe(true);
    expect(isEmptyProgress({ ...onlySettings, srsStates: [srs('a', 1)] })).toBe(false);
  });

  it('empty device: merge with base = local takes all of remote with no conflict', () => {
    const local = data({ userPreferences: [pref('session_intensity', 'light', T2)] });
    const remote = fullSampleData();

    const result = mergeSyncData({ base: local, local, remote }, null);
    expect(result.conflicts).toEqual([]);
    expect(result.merged).toEqual(remote);
  });

  it('merged output is independent of input row order', () => {
    const input = conflictCase();
    input.base.userPreferences = [pref('a', '1'), pref('b', '1')];
    input.local.userPreferences = [pref('a', '2'), pref('b', '1'), pref('c', '1')];
    input.remote.userPreferences = [pref('a', '1'), pref('d', '1')];
    input.local.cognitiveLoadHistory = [day('2026-11-01', 1), day('2026-11-02', 2)];
    input.remote.cognitiveLoadHistory = [day('2026-11-03', 1), day('2026-11-01', 3)];

    const reversed = (side: BackupData): BackupData =>
      Object.fromEntries(
        Object.entries(side).map(([table, rows]) => [table, [...(rows as unknown[])].reverse()]),
      ) as BackupData;
    const shuffled = {
      base: reversed(input.base),
      local: reversed(input.local),
      remote: reversed(input.remote),
    };

    for (const choice of ['local', 'remote'] as const) {
      expect(mergeSyncData(shuffled, choice)).toEqual(mergeSyncData(input, choice));
    }
    expect(mergeSyncData(input, 'local').merged?.userPreferences.map((row) => row.key)).toEqual([
      'a',
      'c',
      'd',
    ]);
  });

  it('output always has empty conversation tables', () => {
    const local = { ...fullSampleData(), aiSessions: [{} as Row<'aiSessions'>] };
    const { merged } = mergeSyncData({ base: null, local, remote: fullSampleData() }, null);
    expect(merged?.aiSessions).toEqual([]);
    expect(merged?.aiMessages).toEqual([]);
  });
});
