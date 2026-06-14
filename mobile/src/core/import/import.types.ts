export type ImportSource = 'wanikani' | 'bunpro' | 'anki';

export type FsrsStateName = 'new' | 'learning' | 'review' | 'relearning';

export type FsrsImportState = {
  stability: number;
  difficulty: number;
  dueDate: string;
  state: FsrsStateName;
  reps: number;
  lapses: number;
  isBurned: boolean;
  srsStageLabel: string;
};

export type WaniKaniAssignment = {
  id: number;
  subject_id: number;
  srs_stage: number;
  srs_stage_name: string;
  burned_at: string | null;
};

export type MappedImportItem = {
  itemId: string;
  externalId: string;
  srsStage: number;
  srsStageName: string;
  fsrsState: FsrsImportState;
};

export type UnmatchedImportItem = {
  externalId: string;
  srsStage: number;
  srsStageName: string;
};

export type ImportSummary = {
  source: ImportSource;
  mappedCount: number;
  unmatchedCount: number;
  burnedCount: number;
  apprenticeCount: number;
};

export type WaniKaniMapResult = {
  mapped: MappedImportItem[];
  unmatched: UnmatchedImportItem[];
  summary: ImportSummary;
};
