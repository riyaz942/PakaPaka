import type {
  BackupData,
  CognitiveLoadHistoryEntry,
  StreakEntry,
  UserPreferenceEntry,
} from '@/core/backup/backup.types';
import { RELATED_ITEM_BOOST_CAP } from '@/config/constants';
import { mergeRows } from '@/core/sync/mergeRows';
import { PREFERENCE_KEYS } from '@/data/user/preferencesRepository';

// Every merge returns rows sorted by `rowKey` (the order of `mergeRows`). None returns a conflict
// except `mergePreferences`.

type PreferenceConflict = {
  key: string;
  local?: UserPreferenceEntry;
  remote?: UserPreferenceEntry;
};

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function later(a: string, b: string): string {
  return a > b ? a : b;
}

/**
 * Three-way counter: `base + (local − base) + (remote − base)`; with no base, the larger side.
 * Missing row = 0. A side equal to the base gives the other side as is (no float drift).
 */
function mergeCounter(hasBase: boolean, base: number, local: number, remote: number): number {
  if (!hasBase) return Math.max(local, remote);
  if (local === base) return remote;
  if (remote === base) return local;
  return local + remote - base;
}

/** Union by key: a row on either side stays. `cardSeen` on both sides keeps the earlier `seenAt`. */
export function mergeAppendOnly<K extends 'cardSeen' | 'importMetadata'>(
  table: K,
  base: BackupData[K] | null,
  local: BackupData[K],
  remote: BackupData[K],
): BackupData[K] {
  const rows = mergeRows(table, base, local, remote).map((entry) => {
    if (entry.local === undefined || entry.remote === undefined) return entry.local ?? entry.remote;
    if (table === 'cardSeen') {
      const [localCard, remoteCard] = [entry.local, entry.remote] as BackupData['cardSeen'];
      return (remoteCard.seenAt < localCard.seenAt ? remoteCard : localCard) as typeof entry.local;
    }
    return entry.decision === 'take_remote' ? entry.remote : entry.local;
  });
  return rows.filter(isDefined) as BackupData[K];
}

/**
 * Three-way rule per answer. Both sides changed it differently: the later `answeredAt` wins
 * (tie: `isCorrect: true`, then the larger `userAnswer`). A deletion against a change keeps the answer.
 */
export function mergePassageResults(
  base: BackupData['passagePracticeResults'] | null,
  local: BackupData['passagePracticeResults'],
  remote: BackupData['passagePracticeResults'],
): BackupData['passagePracticeResults'] {
  return mergeRows('passagePracticeResults', base, local, remote)
    .map((entry) => {
      if (entry.decision === 'take_remote') return entry.remote;
      if (entry.decision !== 'conflict') return entry.local;
      const { local: mine, remote: theirs } = entry;
      if (mine === undefined || theirs === undefined) return mine ?? theirs;
      if (mine.answeredAt !== theirs.answeredAt)
        return mine.answeredAt > theirs.answeredAt ? mine : theirs;
      if (mine.isCorrect !== theirs.isCorrect) return mine.isCorrect ? mine : theirs;
      return mine.userAnswer > theirs.userAnswer ? mine : theirs;
    })
    .filter(isDefined);
}

/**
 * Approved decisions 4. A row is in the result when local or remote has it (deleted on both
 * sides → no row); the counter is clamped at ≥ 0, and a 0 result keeps the row.
 */
export function mergeDailyLessonLog(
  base: BackupData['dailyLessonLog'] | null,
  local: BackupData['dailyLessonLog'],
  remote: BackupData['dailyLessonLog'],
): BackupData['dailyLessonLog'] {
  return mergeRows('dailyLessonLog', base, local, remote).flatMap((entry) => {
    if (entry.local === undefined && entry.remote === undefined) return [];
    const itemsStarted = mergeCounter(
      base !== null,
      entry.base?.itemsStarted ?? 0,
      entry.local?.itemsStarted ?? 0,
      entry.remote?.itemsStarted ?? 0,
    );
    return [{ date: entry.key, itemsStarted: Math.max(itemsStarted, 0) }];
  });
}

/** Approved decisions 4: `load` is a counter (rows kept as in `mergeDailyLessonLog`), `threshold` the larger, `updatedAt` the later. */
export function mergeCognitiveLoad(
  base: BackupData['cognitiveLoadHistory'] | null,
  local: BackupData['cognitiveLoadHistory'],
  remote: BackupData['cognitiveLoadHistory'],
): BackupData['cognitiveLoadHistory'] {
  return mergeRows('cognitiveLoadHistory', base, local, remote).flatMap((entry) => {
    const load = mergeCounter(
      base !== null,
      entry.base?.load ?? 0,
      entry.local?.load ?? 0,
      entry.remote?.load ?? 0,
    );
    const sides = [entry.local, entry.remote].filter(isDefined);
    if (sides.length === 0) return [];
    return [
      {
        date: entry.key,
        load: Math.max(load, 0),
        threshold: Math.max(...sides.map((row) => row.threshold)),
        updatedAt: sides.map((row) => row.updatedAt).reduce(later),
      },
    ];
  });
}

/** Findings 1: counter merge, capped at `RELATED_ITEM_BOOST_CAP`; a result of 0 or less leaves no row. */
export function mergeBoosts(
  base: BackupData['relatedItemBoosts'] | null,
  local: BackupData['relatedItemBoosts'],
  remote: BackupData['relatedItemBoosts'],
): BackupData['relatedItemBoosts'] {
  return mergeRows('relatedItemBoosts', base, local, remote).flatMap((entry) => {
    const merged = mergeCounter(
      base !== null,
      entry.base?.boost ?? 0,
      entry.local?.boost ?? 0,
      entry.remote?.boost ?? 0,
    );
    const sides = [entry.local, entry.remote].filter(isDefined);
    if (merged <= 0 || sides.length === 0) return [];
    return [
      {
        item: sides[0].item,
        boost: Math.min(merged, RELATED_ITEM_BOOST_CAP),
        updatedAt: sides.map((row) => row.updatedAt).reduce(later),
      },
    ];
  });
}

/**
 * One-row three-way rule; both sides changed and differ → remote.
 * A remote delete against a local change gives no row (Approved decisions 3; no code reads goalRingState).
 */
export function mergeSingleton(
  table: 'goalRingState',
  base: BackupData['goalRingState'] | null,
  local: BackupData['goalRingState'],
  remote: BackupData['goalRingState'],
): BackupData['goalRingState'] {
  return mergeRows(table, base, local, remote)
    .map((entry) =>
      entry.decision === 'take_remote' || entry.decision === 'conflict'
        ? entry.remote
        : entry.local,
    )
    .filter(isDefined);
}

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → whole UTC days since the epoch. */
function dayNumber(date: string): number {
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, dayOfMonth) / DAY_MS;
}

/**
 * Recomputes the streak row from the merged history (a study day has `load > 0`) and both
 * sides' last review dates. The longest streak never goes down.
 */
export function mergeStreak(
  local: StreakEntry[],
  remote: StreakEntry[],
  mergedHistory: CognitiveLoadHistoryEntry[],
): StreakEntry[] {
  const sides = [...local, ...remote];
  const days = new Set(mergedHistory.filter((row) => row.load > 0).map((row) => row.date));
  for (const side of sides) {
    if (side.lastReviewDate !== null) days.add(side.lastReviewDate);
  }
  if (days.size === 0 && sides.length === 0) return [];

  const sortedDays = [...days].sort();
  const last = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null;
  const dayNumbers = new Set(sortedDays.map(dayNumber));

  let run = 0;
  if (last !== null) {
    while (dayNumbers.has(dayNumber(last) - run)) run += 1;
  }

  let longestRun = 0;
  let currentRun = 0;
  for (const value of [...dayNumbers].sort((a, b) => a - b)) {
    currentRun = dayNumbers.has(value - 1) ? currentRun + 1 : 1;
    longestRun = Math.max(longestRun, currentRun);
  }

  const currentStreak = Math.max(
    run,
    ...sides.filter((side) => side.lastReviewDate === last).map((side) => side.currentStreak),
  );
  const celebrated = sides
    .map((side) => side.lastCelebratedDate)
    .filter((date): date is string => date !== null);
  // With no streak row on either side, the latest counted history row dates the result.
  const updatedAtSources = sides.length > 0 ? sides : mergedHistory.filter((row) => row.load > 0);

  return [
    {
      currentStreak,
      longestStreak: Math.max(
        currentStreak,
        longestRun,
        ...sides.map((side) => side.longestStreak),
      ),
      lastReviewDate: last,
      lastCelebratedDate: celebrated.length > 0 ? celebrated.reduce(later) : null,
      updatedAt: updatedAtSources.map((row) => row.updatedAt).reduce(later),
    },
  ];
}

/** The value as a list of strings, or `null` when it is not a JSON string array. */
function parseIdList(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Normal three-way rule per key. `seen_unlocked_passage_ids` changed differently on both sides → the
 * sorted union (Findings 2); when either side is missing or not a JSON string array it is a conflict.
 * A conflicting key has no row in `rows`; the caller applies the choice.
 */
export function mergePreferences(
  base: BackupData['userPreferences'] | null,
  local: BackupData['userPreferences'],
  remote: BackupData['userPreferences'],
): { rows: UserPreferenceEntry[]; conflicts: PreferenceConflict[] } {
  const rows: UserPreferenceEntry[] = [];
  const conflicts: PreferenceConflict[] = [];

  for (const entry of mergeRows('userPreferences', base, local, remote)) {
    if (entry.decision !== 'conflict') {
      const row = entry.decision === 'take_remote' ? entry.remote : entry.local;
      if (row !== undefined) rows.push(row);
      continue;
    }
    if (entry.key === PREFERENCE_KEYS.seenUnlockedPassageIds && entry.local && entry.remote) {
      const localIds = parseIdList(entry.local.value);
      const remoteIds = parseIdList(entry.remote.value);
      if (localIds !== null && remoteIds !== null) {
        rows.push({
          key: entry.key,
          value: JSON.stringify([...new Set([...localIds, ...remoteIds])].sort()),
          updatedAt: later(entry.local.updatedAt, entry.remote.updatedAt),
        });
        continue;
      }
    }
    conflicts.push({ key: entry.key, local: entry.local, remote: entry.remote });
  }

  return { rows, conflicts };
}
