import {
  LESSON_GRAMMAR_DAILY_PER_ITEMS,
  LESSON_GRAMMAR_PILE_LIMIT_PER_DAILY_CAP,
  LESSON_GRAMMAR_PILE_WINDOW_DAYS,
} from '@/config/constants';
import type { SRSStageLabel } from '@/core/srs/srs.types';

export type GrammarStart = {
  itemId: string;
  /** ISO timestamp the item went `in_progress`. */
  startedAt: string;
  /** Stored SRS stage, or null when the item has no SRS row yet. */
  stage: SRSStageLabel | null;
};

export type GrammarPace = { startedToday: number; recentApprentice: number };

const DAY_MS = 86_400_000;

/** New grammar per day: grows with the daily setting, never below one. */
export function grammarDailyCap(dailyLessonItems: number): number {
  return Math.max(1, Math.round(dailyLessonItems / LESSON_GRAMMAR_DAILY_PER_ITEMS));
}

/** Recent Apprentice grammar at which new grammar waits. */
export function grammarPileLimit(dailyLessonItems: number): number {
  return grammarDailyCap(dailyLessonItems) * LESSON_GRAMMAR_PILE_LIMIT_PER_DAILY_CAP;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Grammar started on the local calendar day of `now`, and grammar started in
 * the pile window that is still Apprentice (no SRS row counts as Apprentice).
 */
export function summarizeGrammarStarts(starts: GrammarStart[], now: Date): GrammarPace {
  let startedToday = 0;
  let recentApprentice = 0;
  for (const start of starts) {
    const startedAt = new Date(start.startedAt);
    if (isSameLocalDay(startedAt, now)) startedToday++;
    const recent = now.getTime() - startedAt.getTime() < LESSON_GRAMMAR_PILE_WINDOW_DAYS * DAY_MS;
    if (recent && (start.stage === null || start.stage === 'apprentice')) recentApprentice++;
  }
  return { startedToday, recentApprentice };
}

export function isGrammarSlotOpen(pace: GrammarPace, dailyLessonItems: number): boolean {
  return (
    pace.startedToday < grammarDailyCap(dailyLessonItems) &&
    pace.recentApprentice < grammarPileLimit(dailyLessonItems)
  );
}
