import type { AnkiCard, FsrsImportState } from '@/core/import/import.types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type StageConversion = {
  dueOffsetMs: number;
  stability: number;
  difficulty: number;
  state: FsrsImportState['state'];
  isBurned: boolean;
  srsStageLabel: string;
};

const STAGE_CONVERSIONS: Record<number, StageConversion> = {
  1: {
    dueOffsetMs: 4 * HOUR_MS,
    stability: 0.5,
    difficulty: 5,
    state: 'learning',
    isBurned: false,
    srsStageLabel: 'apprentice',
  },
  2: {
    dueOffsetMs: 8 * HOUR_MS,
    stability: 1,
    difficulty: 5,
    state: 'learning',
    isBurned: false,
    srsStageLabel: 'apprentice',
  },
  3: {
    dueOffsetMs: 1 * DAY_MS,
    stability: 2,
    difficulty: 5,
    state: 'review',
    isBurned: false,
    srsStageLabel: 'apprentice',
  },
  4: {
    dueOffsetMs: 2 * DAY_MS,
    stability: 3,
    difficulty: 5,
    state: 'review',
    isBurned: false,
    srsStageLabel: 'apprentice',
  },
  5: {
    dueOffsetMs: 7 * DAY_MS,
    stability: 7,
    difficulty: 4.5,
    state: 'review',
    isBurned: false,
    srsStageLabel: 'guru',
  },
  6: {
    dueOffsetMs: 14 * DAY_MS,
    stability: 14,
    difficulty: 4,
    state: 'review',
    isBurned: false,
    srsStageLabel: 'guru',
  },
  7: {
    dueOffsetMs: 30 * DAY_MS,
    stability: 30,
    difficulty: 3.5,
    state: 'review',
    isBurned: false,
    srsStageLabel: 'master',
  },
  8: {
    dueOffsetMs: 120 * DAY_MS,
    stability: 120,
    difficulty: 3,
    state: 'review',
    isBurned: false,
    srsStageLabel: 'enlightened',
  },
  9: {
    dueOffsetMs: 3650 * DAY_MS,
    stability: 365,
    difficulty: 2,
    state: 'review',
    isBurned: true,
    srsStageLabel: 'burned',
  },
};

export function isSupportedWaniKaniSrsStage(stage: number): stage is keyof typeof STAGE_CONVERSIONS {
  return stage in STAGE_CONVERSIONS;
}

function convertStageToFsrs(srsStage: number, now: Date): FsrsImportState | null {
  const conversion = STAGE_CONVERSIONS[srsStage];
  if (!conversion) {
    return null;
  }

  const dueDate = new Date(now.getTime() + conversion.dueOffsetMs).toISOString();
  const reps = srsStage >= 5 ? srsStage - 4 : srsStage;
  const lapses = 0;

  return {
    stability: conversion.stability,
    difficulty: conversion.difficulty,
    dueDate,
    state: conversion.state,
    reps,
    lapses,
    isBurned: conversion.isBurned,
    srsStageLabel: conversion.srsStageLabel,
  };
}

export function convertWaniKaniStageToFsrs(
  srsStage: number,
  now: Date = new Date(),
): FsrsImportState | null {
  return convertStageToFsrs(srsStage, now);
}

export function isSupportedBunproSrsStage(stage: number): stage is keyof typeof STAGE_CONVERSIONS {
  return stage in STAGE_CONVERSIONS;
}

export function convertBunproStageToFsrs(
  srsStage: number,
  now: Date = new Date(),
): FsrsImportState | null {
  return convertStageToFsrs(srsStage, now);
}

const ANKI_EASE_MIN = 1300;
const ANKI_EASE_MAX = 3500;
const SECOND_MS = 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function convertAnkiEaseToDifficulty(factor: number): number {
  const normalized = clamp(factor, ANKI_EASE_MIN, ANKI_EASE_MAX);
  const difficulty = 10 - ((normalized - ANKI_EASE_MIN) / (ANKI_EASE_MAX - ANKI_EASE_MIN)) * 8;
  return clamp(difficulty, 1, 10);
}

/**
 * Single source of truth for Anki stage labels — used both for the import
 * summary (ankiMapper) and the persisted FSRS state so they can't drift.
 * Branch order mirrors convertAnkiCardToFsrs (relearning before learning-queue).
 */
export function getAnkiSrsStageLabel(card: AnkiCard): string {
  if (card.type === 0) {
    return 'new';
  }
  if (card.type === 3) {
    return 'relearning';
  }
  if (card.type === 1 || card.queue === 1 || card.queue === 3) {
    return 'learning';
  }
  if (card.ivl >= 365 && card.queue !== -1) {
    return 'burned';
  }
  if (card.ivl > 30) {
    return 'master';
  }
  if (card.ivl >= 7) {
    return 'guru';
  }
  return 'apprentice';
}

export function convertAnkiCardToFsrs(
  card: AnkiCard,
  now: Date = new Date(),
): FsrsImportState | null {
  if (card.type === 0 && card.reps === 0) {
    return null;
  }

  const difficulty = convertAnkiEaseToDifficulty(card.factor);
  const reps = card.reps;
  const lapses = card.lapses;
  const srsStageLabel = getAnkiSrsStageLabel(card);

  if (card.type === 3) {
    const stability = Math.max(0.5, card.ivl < 0 ? Math.abs(card.ivl) / 86400 : card.ivl || 0.5);
    const dueOffsetMs = card.ivl < 0 ? Math.abs(card.ivl) * SECOND_MS : card.ivl * DAY_MS;
    return {
      stability,
      difficulty,
      dueDate: new Date(now.getTime() + dueOffsetMs).toISOString(),
      state: 'relearning',
      reps,
      lapses,
      isBurned: false,
      srsStageLabel,
    };
  }

  if (card.type === 1 || card.queue === 1 || card.queue === 3) {
    const stability = Math.max(0.5, card.ivl < 0 ? Math.abs(card.ivl) / 86400 : card.ivl || 0.5);
    const dueOffsetMs = card.ivl < 0 ? Math.abs(card.ivl) * SECOND_MS : card.ivl * DAY_MS;
    return {
      stability,
      difficulty,
      dueDate: new Date(now.getTime() + dueOffsetMs).toISOString(),
      state: 'learning',
      reps,
      lapses,
      isBurned: false,
      srsStageLabel,
    };
  }

  if (card.type === 2 || card.queue === -1 || card.queue === -2) {
    const intervalDays = Math.max(card.ivl, 0);
    const stability = intervalDays > 0 ? intervalDays : 0.5;
    const isBurned = intervalDays >= 365 && card.queue !== -1;
    const dueOffsetMs = intervalDays > 0 ? intervalDays * DAY_MS : 0;

    return {
      stability: isBurned ? Math.min(intervalDays, 365) : stability,
      difficulty,
      dueDate: new Date(now.getTime() + dueOffsetMs).toISOString(),
      state: 'review',
      reps,
      lapses,
      isBurned,
      srsStageLabel: isBurned ? 'burned' : srsStageLabel,
    };
  }

  return null;
}
