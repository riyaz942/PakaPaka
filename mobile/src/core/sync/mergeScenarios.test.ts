import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { mergeSyncData } from '@/core/sync/mergeSyncData';
import { emptySyncData } from '@/core/sync/syncSamples.testutil';

// Part 3 "done when", as pure functions: each device is a BackupData, the server holds one file.

type Row<K extends keyof BackupData> = BackupData[K][number];

const T0 = '2026-11-15T00:00:00.000Z';
const PHONE_AT = '2026-11-16T08:00:00.000Z';
const WEB_AT = '2026-11-16T09:00:00.000Z';
const YESTERDAY = '2026-11-15';
const TODAY = '2026-11-16';

function item(slug: string): ItemRef {
  return { itemType: 'kanji', slug };
}

function srs(slug: string, stability: number, reps: number, updatedAt: string): Row<'srsStates'> {
  return {
    item: item(slug),
    stability,
    difficulty: 5,
    dueDate: '2026-11-20T00:00:00.000Z',
    fsrsState: 'review',
    reps,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'Apprentice 3',
    lastReviewedAt: reps > 1 ? updatedAt : null,
    updatedAt,
  };
}

function weakness(slug: string, correctCount: number, updatedAt: string): Row<'weaknessStats'> {
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

function load(date: string, value: number, updatedAt: string): Row<'cognitiveLoadHistory'> {
  return { date, load: value, threshold: 40, updatedAt };
}

function streak(currentStreak: number, lastReviewDate: string, updatedAt: string): Row<'streaks'> {
  return { currentStreak, longestStreak: 5, lastReviewDate, lastCelebratedDate: null, updatedAt };
}

function boost(slug: string, value: number, updatedAt: string): Row<'relatedItemBoosts'> {
  return { item: item(slug), boost: value, updatedAt };
}

/** The last synced file: items 1 and 2 learned, one study day yesterday. */
function baseFile(): BackupData {
  return {
    ...emptySyncData(),
    srsStates: [srs('1', 2, 1, T0), srs('2', 2, 1, T0)],
    weaknessStats: [weakness('1', 1, T0), weakness('2', 1, T0)],
    cognitiveLoadHistory: [load(YESTERDAY, 4, T0)],
    streaks: [streak(1, YESTERDAY, T0)],
    relatedItemBoosts: [boost('3', 0.25, T0)],
  };
}

/** One review of `slug` on a device at `base`: srs, weakness, today's load +1, streak, boost of item 3. */
function review(
  device: BackupData,
  slug: string,
  stability: number,
  boostStep: number,
  at: string,
): BackupData {
  const today = device.cognitiveLoadHistory.find((row) => row.date === TODAY);
  return {
    ...device,
    srsStates: device.srsStates.map((row) =>
      row.item.slug === slug ? srs(slug, stability, row.reps + 1, at) : row,
    ),
    weaknessStats: device.weaknessStats.map((row) =>
      row.item.slug === slug ? weakness(slug, row.correctCount + 1, at) : row,
    ),
    cognitiveLoadHistory: [
      ...device.cognitiveLoadHistory.filter((row) => row.date !== TODAY),
      load(TODAY, (today?.load ?? 0) + 1, at),
    ],
    streaks: [streak(2, TODAY, at)],
    relatedItemBoosts: device.relatedItemBoosts.map((row) =>
      row.item.slug === '3' ? boost('3', row.boost + boostStep, at) : row,
    ),
  };
}

describe('merge scenarios', () => {
  it('two devices review different items: no conflict, both reviews kept', () => {
    const base = baseFile();
    const phone = review(base, '1', 3, 0.125, PHONE_AT);
    const web = review(base, '2', 4, 0.25, WEB_AT);

    // The phone pushed first; the web merges against it.
    const { conflicts, merged } = mergeSyncData({ base, local: web, remote: phone }, null);

    expect(conflicts).toEqual([]);
    expect(merged?.srsStates).toEqual([srs('1', 3, 2, PHONE_AT), srs('2', 4, 2, WEB_AT)]);
    expect(merged?.weaknessStats).toEqual([weakness('1', 2, PHONE_AT), weakness('2', 2, WEB_AT)]);
    // Today: base 0 + phone 1 + web 1.
    expect(merged?.cognitiveLoadHistory).toEqual([load(YESTERDAY, 4, T0), load(TODAY, 2, WEB_AT)]);
    expect(merged?.relatedItemBoosts).toEqual([boost('3', 0.25 + 0.125 + 0.25, WEB_AT)]);
    expect(merged?.streaks).toEqual([streak(2, TODAY, WEB_AT)]);
  });

  it("both devices review the same item: one entry; local choice and remote choice give that side's rows", () => {
    const base = baseFile();
    const phone = review(base, '1', 3, 0.125, PHONE_AT);
    const web = review(base, '1', 4, 0.25, WEB_AT);
    const input = { base, local: web, remote: phone };

    const first = mergeSyncData(input, null);
    expect(first.merged).toBeNull();
    expect(first.conflicts).toEqual([
      { kind: 'item', item: item('1'), localUpdatedAt: WEB_AT, remoteUpdatedAt: PHONE_AT },
    ]);

    const keepLocal = mergeSyncData(input, 'local').merged;
    expect(keepLocal?.srsStates).toEqual(web.srsStates);
    expect(keepLocal?.weaknessStats).toEqual(web.weaknessStats);

    const keepRemote = mergeSyncData(input, 'remote').merged;
    expect(keepRemote?.srsStates).toEqual(phone.srsStates);
    expect(keepRemote?.weaknessStats).toEqual(phone.weaknessStats);

    // Counters and boosts never follow the choice: both reviews count.
    for (const merged of [keepLocal, keepRemote]) {
      expect(merged?.cognitiveLoadHistory).toContainEqual(load(TODAY, 2, WEB_AT));
      expect(merged?.relatedItemBoosts).toEqual([boost('3', 0.625, WEB_AT)]);
    }
  });

  it('convergence', () => {
    const start = baseFile();
    // Device B reviews item 2 and pushes: the server file and B's base are now `pushedByB`.
    const pushedByB = review(start, '2', 4, 0.25, PHONE_AT);
    // Device A (base `start`) reviews item 1, merges against B's file and pushes M.
    const deviceA = review(start, '1', 3, 0.125, WEB_AT);
    const a = mergeSyncData({ base: start, local: deviceA, remote: pushedByB }, null);
    expect(a.conflicts).toEqual([]);
    const m = a.merged as BackupData;

    // Device B has no other change: it ends at M with no conflict.
    const b = mergeSyncData({ base: pushedByB, local: pushedByB, remote: m }, null);
    expect(b.conflicts).toEqual([]);
    expect(b.merged).toEqual(m);

    // Device A syncs again: nothing changes.
    expect(mergeSyncData({ base: m, local: m, remote: m }, null).merged).toEqual(m);
  });
});
