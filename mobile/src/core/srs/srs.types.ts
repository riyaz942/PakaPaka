import type { RelatedItem, ReinforcementLink } from '@/core/content/content.types';

export type SRSStageLabel = 'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned';

export type FsrsStateString = 'new' | 'learning' | 'review' | 'relearning';

export type SRSState = {
  itemId: string;
  stability: number;
  difficulty: number;
  dueDate: string; // ISO 8601 UTC
  fsrsState: FsrsStateString;
  reps: number;
  lapses: number;
  isBurned: boolean;
  srsStageLabel: SRSStageLabel;
  updatedAt: string;
};

/** 1=Again 2=Hard 3=Good 4=Easy — matches ts-fsrs Rating enum (Manual excluded) */
export type ReviewGrade = 1 | 2 | 3 | 4;

export type ReviewAnswerKey = {
  acceptedMeanings: string[];
  acceptedReadings: string[];
  grammar?: {
    structure: string;
    conjugationRules: Record<string, unknown>;
    acceptedForms: string[];
  };
};

export type ReviewItem = {
  itemId: string;
  itemType: 'radical' | 'kanji' | 'vocabulary' | 'grammar';
  primaryForm: string;
  meanings: string[];
  srsState: SRSState;
  promptType: 'reading' | 'meaning' | 'production';
  mnemonic?: string | null;
  personalMnemonic?: string | null;
  answerKey: ReviewAnswerKey;
  relatedItems: RelatedItem[];
  reinforcementLink: ReinforcementLink | null;
};

export type QueueBuildOptions = {
  now?: Date;
  limit?: number;
  weaknessScores?: Map<string, number>; // reserved for Epic 6; defaults to 0
};
