import type { BackupData } from '@/core/backup/backup.types';
import { diffSyncData, sameSyncData } from '@/core/sync/diffSyncData';
import { SYNC_TABLE_KEYS, type KnownContent } from '@/core/sync/sync.types';
import { emptySyncData, fullSampleData } from '@/core/sync/syncSamples.testutil';
import { rowKey } from '@/core/sync/syncTables';

type Row<K extends keyof BackupData> = BackupData[K][number];

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';

const knowsAll: KnownContent = { hasItem: () => true, hasPassageQuestion: () => true };

function mnemonic(slug: string, mnemonicText: string, updatedAt = T1): Row<'personalMnemonics'> {
  return { item: { itemType: 'kanji', slug }, mnemonicText, updatedAt };
}

function pref(key: string, value: string, updatedAt = T1): Row<'userPreferences'> {
  return { key, value, updatedAt };
}

/** Writes the diff into a copy of `from`, the way the apply step writes it into SQLite. */
function applyDiff(from: BackupData, diff: ReturnType<typeof diffSyncData>): BackupData {
  const result = { ...from };
  for (const table of SYNC_TABLE_KEYS) {
    const key = (row: never) => rowKey(table, row);
    const rows = new Map((from[table] as never[]).map((row) => [key(row), row]));
    for (const row of diff[table].deletes as never[]) rows.delete(key(row));
    for (const row of diff[table].upserts as never[]) rows.set(key(row), row);
    (result as Record<string, unknown>)[table] = [...rows.values()];
  }
  return result;
}

describe('diffSyncData', () => {
  it('diffSyncData: changed row → upsert; row missing in to → delete; unknown item row → not in the diff; updatedAt-only change → not in the diff', () => {
    const from: BackupData = {
      ...emptySyncData(),
      personalMnemonics: [
        mnemonic('changed', 'old'),
        mnemonic('removed', 'gone'),
        mnemonic('unknown', 'old'),
        mnemonic('touched', 'same'),
      ],
      userPreferences: [pref('session_intensity', 'light')],
    };
    const to: BackupData = {
      ...emptySyncData(),
      personalMnemonics: [
        mnemonic('added', 'new'),
        mnemonic('changed', 'new', T2),
        mnemonic('unknown', 'new', T2),
        mnemonic('touched', 'same', T2),
      ],
      userPreferences: [pref('session_intensity', 'light', T2)],
    };
    const known: KnownContent = {
      hasItem: (ref) => ref.slug !== 'unknown',
      hasPassageQuestion: () => true,
    };

    const diff = diffSyncData(from, to, known);
    expect(diff.personalMnemonics).toEqual({
      upserts: [mnemonic('added', 'new'), mnemonic('changed', 'new', T2)],
      deletes: [mnemonic('removed', 'gone')],
    });
    expect(diff.userPreferences).toEqual({ upserts: [], deletes: [] });
    for (const table of SYNC_TABLE_KEYS) {
      expect(Object.keys(diff)).toContain(table);
    }
  });

  it('leaves out a passage row this device does not know', () => {
    const passage = (questionId: string): Row<'passagePracticeResults'> => ({
      passageId: '7',
      questionId,
      isCorrect: true,
      userAnswer: 'a',
      answeredAt: T1,
    });
    const known: KnownContent = {
      hasItem: () => true,
      hasPassageQuestion: (_passageId, questionId) => questionId !== '2',
    };
    const to = { ...emptySyncData(), passagePracticeResults: [passage('1'), passage('2')] };

    expect(diffSyncData(emptySyncData(), to, known).passagePracticeResults).toEqual({
      upserts: [passage('1')],
      deletes: [],
    });
  });

  it('never deletes a row this device does not know', () => {
    const from = {
      ...emptySyncData(),
      personalMnemonics: [mnemonic('known', 'a'), mnemonic('unknown', 'b')],
    };
    const known: KnownContent = {
      hasItem: (ref) => ref.slug !== 'unknown',
      hasPassageQuestion: () => true,
    };

    expect(diffSyncData(from, emptySyncData(), known).personalMnemonics).toEqual({
      upserts: [],
      deletes: [mnemonic('known', 'a')],
    });
  });
});

describe('sameSyncData', () => {
  it('sameSyncData is true after applying a diff in memory', () => {
    const from = fullSampleData();
    const to: BackupData = {
      ...emptySyncData(),
      srsStates: [{ ...from.srsStates[0], reps: 9 }],
      personalMnemonics: [mnemonic('hi', 'sun')],
      streaks: from.streaks,
    };
    expect(sameSyncData(from, to)).toBe(false);

    const applied = applyDiff(from, diffSyncData(from, to, knowsAll));
    expect(sameSyncData(applied, to)).toBe(true);
  });

  it('ignores updatedAt and row order; a missing or changed row makes it false', () => {
    const a = { ...emptySyncData(), personalMnemonics: [mnemonic('a', 'x'), mnemonic('b', 'y')] };
    const reordered = {
      ...emptySyncData(),
      personalMnemonics: [mnemonic('b', 'y', T2), mnemonic('a', 'x', T2)],
    };
    expect(sameSyncData(a, reordered)).toBe(true);
    expect(sameSyncData(a, { ...a, personalMnemonics: [mnemonic('a', 'x')] })).toBe(false);
    expect(
      sameSyncData(a, { ...a, personalMnemonics: [mnemonic('a', 'x'), mnemonic('b', 'z')] }),
    ).toBe(false);
  });
});
