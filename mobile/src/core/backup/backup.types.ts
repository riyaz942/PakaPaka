import type { ItemType } from '@/data/curriculum/itemRepository';

/**
 * A curriculum item reference keyed by its stable `(item_type, slug)` pair
 * rather than the `curriculum.db` integer row id, which shifts on
 * recompile/OTA (AC1).
 */
export type ItemRef = {
  itemType: ItemType;
  slug: string;
};

export type UserPreferenceEntry = {
  key: string;
  value: string;
  updatedAt: string;
};

export type ItemStudyStatusEntry = {
  item: ItemRef;
  status: 'known' | 'in_progress' | 'not_started';
  updatedAt: string;
};

export type SrsStateEntry = {
  item: ItemRef;
  stability: number;
  difficulty: number;
  dueDate: string;
  fsrsState: 'new' | 'learning' | 'review' | 'relearning';
  reps: number;
  lapses: number;
  learningSteps: number;
  isBurned: boolean;
  srsStageLabel: string;
  lastReviewedAt: string | null;
  updatedAt: string;
};

export type ImportMetadataEntry = {
  source: 'wanikani' | 'bunpro' | 'anki';
  importedAt: string;
  mappedCount: number;
  unmatchedCount: number;
};

export type PersonalMnemonicEntry = {
  item: ItemRef;
  mnemonicText: string;
  updatedAt: string;
};

export type RelatedItemBoostEntry = {
  item: ItemRef;
  boost: number;
  updatedAt: string;
};

export type WeaknessStatEntry = {
  item: ItemRef;
  correctCount: number;
  incorrectCount: number;
  typoCount: number;
  lastErrorAt: string | null;
  lastErrorType: string | null;
  patternTags: string | null;
  updatedAt: string;
};

export type CognitiveLoadHistoryEntry = {
  date: string;
  load: number;
  threshold: number;
  updatedAt: string;
};

export type StreakEntry = {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  lastCelebratedDate: string | null;
  updatedAt: string;
};

export type UserSynonymEntry = {
  item: ItemRef;
  answerType: 'meaning' | 'reading';
  answerText: string;
  createdAt: string;
};

export type DailyLessonLogEntry = {
  date: string;
  itemsStarted: number;
};

export type GoalRingStateEntry = {
  dailyGoalTarget: number | null;
  goalWeekStart: string | null;
  consecutiveMissWeeks: number;
  pendingRiseTo: number | null;
  pendingReductionTo: number | null;
  updatedAt: string;
};

export type FuriganaOverrideEntry = {
  item: ItemRef;
  displayMode: 'shown' | 'hidden';
  updatedAt: string;
};

/** Guidance cards (Epic 7) the learner has already been shown. Card ids are static app-known strings, not curriculum items — no slug resolution. */
export type CardSeenEntry = {
  cardId: string;
  seenAt: string;
};

/**
 * `passage_id`/`question_id` reference `reading_passages`/`passage_questions`,
 * which have no `slug` column (unlike `items`) — out of AC1's item-slug scope,
 * so these stay raw curriculum row ids.
 */
export type PassagePracticeResultEntry = {
  passageId: string;
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  answeredAt: string;
};

export type AiSessionEntry = {
  id: string;
  provider: string;
  model: string;
  mode: string;
  topicItem: ItemRef | null;
  topicItems: ItemRef[];
  startedAt: string;
  endedAt: string | null;
  endedReason: string | null;
  turnCount: number;
  summaryJson: string | null;
  summaryGeneratedAt: string | null;
};

export type AiMessageEntry = {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type BackupData = {
  userPreferences: UserPreferenceEntry[];
  itemStudyStatus: ItemStudyStatusEntry[];
  srsStates: SrsStateEntry[];
  importMetadata: ImportMetadataEntry[];
  personalMnemonics: PersonalMnemonicEntry[];
  relatedItemBoosts: RelatedItemBoostEntry[];
  weaknessStats: WeaknessStatEntry[];
  cognitiveLoadHistory: CognitiveLoadHistoryEntry[];
  streaks: StreakEntry[];
  userSynonyms: UserSynonymEntry[];
  dailyLessonLog: DailyLessonLogEntry[];
  goalRingState: GoalRingStateEntry[];
  furiganaOverrides: FuriganaOverrideEntry[];
  cardSeen: CardSeenEntry[];
  passagePracticeResults: PassagePracticeResultEntry[];
  aiSessions: AiSessionEntry[];
  aiMessages: AiMessageEntry[];
};

export const BACKUP_DATA_KEYS: readonly (keyof BackupData)[] = [
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
  'aiSessions',
  'aiMessages',
];

export type BackupEnvelopeInput = {
  schemaVersion: number;
  curriculumVersion: string | null;
  exportedAt: string;
  includesConversations: boolean;
};

export type BackupEnvelope = BackupEnvelopeInput & {
  format: 'kizamu-backup';
  formatVersion: 1;
};

export type BackupBundle = BackupEnvelope & {
  data: BackupData;
};
