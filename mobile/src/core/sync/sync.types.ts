import type { BackupData, ItemRef } from '@/core/backup/backup.types';

/** The 18 tables that sync; the two conversation tables never do. */
export type SyncTableKey = Exclude<keyof BackupData, 'aiSessions' | 'aiMessages'>;

export const SYNC_TABLE_KEYS: readonly SyncTableKey[] = [
  'userPreferences',
  'itemStudyStatus',
  'srsStates',
  'importMetadata',
  'personalMnemonics',
  'relatedItemBoosts',
  'weaknessStats',
  'cognitiveLoadHistory',
  'streaks',
  'userSynonyms',
  'dailyLessonLog',
  'goalRingState',
  'furiganaOverrides',
  'cardSeen',
  'passagePracticeResults',
  'grammarAnswers',
  'grammarSentenceHistory',
  'lessonOptIns',
];

/** What this device's curriculum has; rows for unknown content stay only in the base copy. */
export type KnownContent = {
  hasItem(ref: ItemRef): boolean;
  hasPassageQuestion(passageId: string, questionId: string): boolean;
};

export type ConflictChoice = 'local' | 'remote';

/** `null` means that side has no row. */
export type ConflictEntry =
  | {
      kind: 'item';
      item: ItemRef;
      localUpdatedAt: string | null;
      remoteUpdatedAt: string | null;
    }
  | {
      kind: 'preference';
      key: string;
      localUpdatedAt: string | null;
      remoteUpdatedAt: string | null;
    };

export type SyncErrorCode =
  | 'sync_update_required'
  | 'sync_bad_file'
  | 'sync_busy'
  | 'sync_local_failed'
  | 'sync_local_changed';
