import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppError } from '@/types/result.types';

export type CurriculumUpdateSource = 'bundled' | 'downloaded';

/** A verified, signed curriculum release (see core/curriculum/manifestSignature.ts). */
export type CurriculumRelease = {
  schema: number;
  version: number;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  keyId: string;
};

export type CheckAndApplyCurriculumUpdateResult =
  | { status: 'skipped' }
  | { status: 'up_to_date' }
  | { status: 'deferred' }
  | { status: 'success'; version: string; curriculumDb: SQLiteDatabase }
  | { status: 'error'; error: AppError; curriculumDb?: SQLiteDatabase };
