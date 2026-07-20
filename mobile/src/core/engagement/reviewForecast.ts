import { FORECAST_WALL_MIN_DUE, FORECAST_WALL_RATIO } from '@/config/constants';

export type ForecastDay = {
  /** Local calendar date key YYYY-MM-DD. */
  dateKey: string;
  /** Weekday short label for display, e.g. "Wed". */
  weekdayLabel: string;
  /** Whether this cell is today. */
  isToday: boolean;
  /** Due review count bucketed into this local day (overdue folds into today). */
  count: number;
};

export type ReviewForecast = {
  days: ForecastDay[];
  totalCount: number;
  /** Date key of the flagged wall day, or null when no day qualifies. */
  wallDateKey: string | null;
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Buckets due dates (ISO strings from non-burned srs_states) into the seven
 * local calendar days today → today+6. Anything already overdue counts toward
 * today; dues beyond the window are ignored.
 *
 * Wall rule (brainstorm O3): flag the max-count day when
 * `max >= max(FORECAST_WALL_MIN_DUE, ceil(mean × FORECAST_WALL_RATIO))`.
 * A flat heavy week has no wall — the annotation is for spikes only.
 */
export function buildReviewForecast(dueDates: string[], now: Date = new Date()): ReviewForecast {
  const days: ForecastDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    days.push({
      dateKey: localDateKey(day),
      weekdayLabel: WEEKDAY_LABELS[day.getDay()],
      isToday: offset === 0,
      count: 0,
    });
  }

  const todayKey = days[0].dateKey;
  const lastKey = days[6].dateKey;
  const countsByKey = new Map(days.map((day) => [day.dateKey, day]));

  let totalCount = 0;
  for (const iso of dueDates) {
    const due = new Date(iso);
    if (Number.isNaN(due.getTime())) continue;
    let key = localDateKey(due);
    if (key < todayKey) key = todayKey; // overdue folds into today
    if (key > lastKey) continue;
    const bucket = countsByKey.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    totalCount += 1;
  }

  const max = Math.max(...days.map((day) => day.count));
  const mean = totalCount / 7;
  const threshold = Math.max(FORECAST_WALL_MIN_DUE, Math.ceil(mean * FORECAST_WALL_RATIO));
  const wallDateKey =
    max >= threshold ? (days.find((day) => day.count === max)?.dateKey ?? null) : null;

  return { days, totalCount, wallDateKey };
}
