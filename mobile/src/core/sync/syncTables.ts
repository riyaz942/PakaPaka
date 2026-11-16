import type { BackupData, ItemRef } from '@/core/backup/backup.types';
import { itemRefKey } from '@/core/backup/slugResolver';
import type { SyncTableKey } from '@/core/sync/sync.types';
import { PREFERENCE_KEYS } from '@/data/user/preferencesRepository';

export type TableKind =
  | 'preference'
  | 'per_item'
  | 'boost'
  | 'append_only'
  | 'passage'
  | 'per_day'
  | 'singleton';

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string|null'
  | 'number|null'
  | 'itemRef'
  | 'string[]';

export type TableDescriptor<Row> = {
  kind: TableKind;
  key(row: Row): string;
  /** Fields left out of the same-row compare. */
  ignored: readonly string[];
  /** Every field of the entry type in `backup.types.ts`. */
  fields: Record<string, FieldType>;
};

type SyncRow<K extends SyncTableKey> = BackupData[K][number];

const SINGLETON_KEY = '1';

/** Joins key parts with `|`; `\` and `|` inside a part are escaped so two different rows never share a key. */
function joinKey(...parts: string[]): string {
  return parts.map((part) => part.replace(/[\\|]/g, '\\$&')).join('|');
}

export const SYNC_TABLES: { [K in SyncTableKey]: TableDescriptor<SyncRow<K>> } = {
  userPreferences: {
    kind: 'preference',
    key: (row) => row.key,
    ignored: ['updatedAt'],
    fields: { key: 'string', value: 'string', updatedAt: 'string' },
  },
  itemStudyStatus: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: { item: 'itemRef', status: 'string', updatedAt: 'string' },
  },
  srsStates: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: {
      item: 'itemRef',
      stability: 'number',
      difficulty: 'number',
      dueDate: 'string',
      fsrsState: 'string',
      reps: 'number',
      lapses: 'number',
      learningSteps: 'number',
      isBurned: 'boolean',
      srsStageLabel: 'string',
      lastReviewedAt: 'string|null',
      updatedAt: 'string',
    },
  },
  importMetadata: {
    kind: 'append_only',
    key: (row) => joinKey(row.source, row.importedAt),
    ignored: [],
    fields: {
      source: 'string',
      importedAt: 'string',
      mappedCount: 'number',
      unmatchedCount: 'number',
    },
  },
  personalMnemonics: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: { item: 'itemRef', mnemonicText: 'string', updatedAt: 'string' },
  },
  relatedItemBoosts: {
    kind: 'boost',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: { item: 'itemRef', boost: 'number', updatedAt: 'string' },
  },
  weaknessStats: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: {
      item: 'itemRef',
      correctCount: 'number',
      incorrectCount: 'number',
      typoCount: 'number',
      lastErrorAt: 'string|null',
      lastErrorType: 'string|null',
      patternTags: 'string|null',
      updatedAt: 'string',
    },
  },
  cognitiveLoadHistory: {
    kind: 'per_day',
    key: (row) => row.date,
    ignored: ['updatedAt'],
    fields: { date: 'string', load: 'number', threshold: 'number', updatedAt: 'string' },
  },
  streaks: {
    kind: 'singleton',
    key: () => SINGLETON_KEY,
    ignored: ['updatedAt'],
    fields: {
      currentStreak: 'number',
      longestStreak: 'number',
      lastReviewDate: 'string|null',
      lastCelebratedDate: 'string|null',
      updatedAt: 'string',
    },
  },
  userSynonyms: {
    kind: 'per_item',
    key: (row) => joinKey(itemRefKey(row.item), row.answerType, row.answerText),
    ignored: ['createdAt'],
    fields: { item: 'itemRef', answerType: 'string', answerText: 'string', createdAt: 'string' },
  },
  dailyLessonLog: {
    kind: 'per_day',
    key: (row) => row.date,
    ignored: [],
    fields: { date: 'string', itemsStarted: 'number' },
  },
  goalRingState: {
    kind: 'singleton',
    key: () => SINGLETON_KEY,
    ignored: ['updatedAt'],
    fields: {
      dailyGoalTarget: 'number|null',
      goalWeekStart: 'string|null',
      consecutiveMissWeeks: 'number',
      pendingRiseTo: 'number|null',
      pendingReductionTo: 'number|null',
      updatedAt: 'string',
    },
  },
  furiganaOverrides: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: { item: 'itemRef', displayMode: 'string', updatedAt: 'string' },
  },
  cardSeen: {
    kind: 'append_only',
    key: (row) => row.cardId,
    ignored: ['seenAt'],
    fields: { cardId: 'string', seenAt: 'string' },
  },
  passagePracticeResults: {
    kind: 'passage',
    key: (row) => joinKey(row.passageId, row.questionId),
    ignored: [],
    fields: {
      passageId: 'string',
      questionId: 'string',
      isCorrect: 'boolean',
      userAnswer: 'string',
      answeredAt: 'string',
    },
  },
  grammarAnswers: {
    kind: 'per_item',
    key: (row) => joinKey(itemRefKey(row.item), row.sentenceKey, row.answerText),
    ignored: ['createdAt'],
    fields: { item: 'itemRef', sentenceKey: 'string', answerText: 'string', createdAt: 'string' },
  },
  grammarSentenceHistory: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['updatedAt'],
    fields: { item: 'itemRef', sentenceKeys: 'string[]', updatedAt: 'string' },
  },
  lessonOptIns: {
    kind: 'per_item',
    key: (row) => itemRefKey(row.item),
    ignored: ['optedInAt'],
    fields: { item: 'itemRef', optedInAt: 'string' },
  },
};

export function rowKey<K extends SyncTableKey>(table: K, row: SyncRow<K>): string {
  return (SYNC_TABLES[table] as TableDescriptor<SyncRow<K>>).key(row);
}

function valuesEqual(type: FieldType, a: unknown, b: unknown): boolean {
  if (type === 'itemRef') {
    const left = a as ItemRef;
    const right = b as ItemRef;
    return left.itemType === right.itemType && left.slug === right.slug;
  }
  if (type === 'string[]') {
    const left = a as string[];
    const right = b as string[];
    return left.length === right.length && left.every((entry, index) => entry === right[index]);
  }
  return a === b;
}

/** Same row = every field equal except the ignored ones. Two missing rows are equal; one missing is not. */
export function rowsEqual<K extends SyncTableKey>(
  table: K,
  a: SyncRow<K> | undefined,
  b: SyncRow<K> | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  const { fields, ignored } = SYNC_TABLES[table];
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  for (const [name, type] of Object.entries(fields)) {
    if (ignored.includes(name)) continue;
    if (!valuesEqual(type, left[name], right[name])) return false;
  }
  return true;
}

/** The `itemType:slug` key of a per-item or boost row; `null` for every other kind. */
export function itemKeyOf<K extends SyncTableKey>(table: K, row: SyncRow<K>): string | null {
  const { kind } = SYNC_TABLES[table];
  if (kind !== 'per_item' && kind !== 'boost') return null;
  return itemRefKey((row as unknown as { item: ItemRef }).item);
}

/** Device-local settings and curriculum bookkeeping: removed before a push, ignored in a pulled file. */
export const NEVER_SYNCED_PREFERENCE_KEYS: ReadonlySet<string> = new Set([
  PREFERENCE_KEYS.installedCurriculumVersion,
  PREFERENCE_KEYS.installedCurriculumContentHash,
  PREFERENCE_KEYS.curriculumUpdateSource,
  PREFERENCE_KEYS.lastBackedUpAt,
  PREFERENCE_KEYS.aiOpenAiBaseUrl,
  PREFERENCE_KEYS.aiActiveProvider,
  PREFERENCE_KEYS.aiOpenAiModel,
  PREFERENCE_KEYS.aiAnthropicModel,
  PREFERENCE_KEYS.cloudSttOptIn,
  PREFERENCE_KEYS.wordTranslateOptIn,
  PREFERENCE_KEYS.notificationsEnabled,
  PREFERENCE_KEYS.notificationReminderTime,
  PREFERENCE_KEYS.reducedMotion,
  PREFERENCE_KEYS.themeMode,
  PREFERENCE_KEYS.hapticsEnabled,
]);
