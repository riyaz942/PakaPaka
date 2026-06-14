import type { FsrsImportState } from '@/core/import/import.types';

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
