import type { ReviewForecast as ReviewForecastData } from '@/core/engagement/reviewForecast';
import type { HomeSectionId } from '@/core/engagement/homeLayout';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import type { AtRiskListItem } from '@/data/hooks/useAtRiskItems';
import type { ReadingReadinessTarget } from '@/data/hooks/useReadingReadiness';

/**
 * Static sample data for the customizer's preview tiles. Deliberately not the
 * live hooks — a learner with no at-risk items or reading target still needs
 * to see and place those sections, and the customizer must not fire six data
 * queries just to draw a settings screen.
 */

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  'goal-ring': 'Goal ring',
  'review-cta': 'Review',
  'lesson-cta': "Today's lesson",
  'level-progress': 'Level progress',
  'review-forecast': 'Review forecast',
  'reading-readiness': 'Reading readiness',
  'at-risk': 'At-risk items',
};

/** Shown under sections that only sometimes render on Home. */
export const HOME_SECTION_CAPTIONS: Partial<Record<HomeSectionId, string>> = {
  'reading-readiness': 'Appears once a passage is nearly in reach.',
  'at-risk': 'Appears when items are slipping.',
};

export const PREVIEW_GOAL_RING_PERCENT = 62;

export const PREVIEW_LEVEL: JLPTLevel = 'N5';

export const PREVIEW_LEVEL_PER_TYPE = {
  kanji: { started: 40, total: 103 },
  vocabulary: { started: 120, total: 400 },
  grammar: { started: 12, total: 60 },
};

export const PREVIEW_LEVEL_OVERALL_PERCENT = 34;

export const PREVIEW_FORECAST: ReviewForecastData = {
  days: [
    { dateKey: '2026-01-05', weekdayLabel: 'Mon', isToday: true, count: 6 },
    { dateKey: '2026-01-06', weekdayLabel: 'Tue', isToday: false, count: 3 },
    { dateKey: '2026-01-07', weekdayLabel: 'Wed', isToday: false, count: 4 },
    { dateKey: '2026-01-08', weekdayLabel: 'Thu', isToday: false, count: 9 },
    { dateKey: '2026-01-09', weekdayLabel: 'Fri', isToday: false, count: 2 },
    { dateKey: '2026-01-10', weekdayLabel: 'Sat', isToday: false, count: 0 },
    { dateKey: '2026-01-11', weekdayLabel: 'Sun', isToday: false, count: 5 },
  ],
  totalCount: 29,
  dueNowCount: 4,
  laterTodayCount: 2,
  wallDateKey: '2026-01-08',
};

export const PREVIEW_READING_TARGET: ReadingReadinessTarget = {
  passageId: 'preview',
  title: '自己紹介',
  itemsRemainingToUnlock: 4,
  coverage: 0.55,
  noProgressYet: false,
};

const PREVIEW_AT_RISK_ITEM: AtRiskListItem = {
  itemId: 'preview',
  primaryForm: '食べる',
  meaning: 'to eat',
  itemType: 'vocabulary',
};

export const PREVIEW_AT_RISK_TOTAL_COUNT = 3;
export const PREVIEW_AT_RISK_TOP_ITEMS: AtRiskListItem[] = [PREVIEW_AT_RISK_ITEM];
export const PREVIEW_AT_RISK_ALL_ITEMS: AtRiskListItem[] = [PREVIEW_AT_RISK_ITEM];
