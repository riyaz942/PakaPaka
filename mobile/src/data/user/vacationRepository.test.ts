import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import type { SRSState } from '@/core/srs/srs.types';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { migration003SrsStatesAndImportMetadata } from '@/data/migrations/003_srs_states_and_import_metadata';
import { migration010SrsLastReviewedAt } from '@/data/migrations/010_srs_last_reviewed_at';
import { migration011SrsLearningSteps } from '@/data/migrations/011_srs_learning_steps';
import { migration015GoalRingState } from '@/data/migrations/015_goal_ring_state';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { getGoalRingState } from '@/data/user/goalRingRepository';
import {
  getVacationStartedAt,
  setVacationStartedAt,
} from '@/data/user/preferencesRepository';
import { getSrsState, upsertSrsState } from '@/data/user/srsStateRepository';
import {
  endVacation,
  isVacationActive,
  startVacation,
} from '@/data/user/vacationRepository';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const VACATION_START = new Date('2026-07-01T09:00:00.000Z');
/** Ten days later — the whole point is that the queue survives this gap. */
const RESUME = new Date('2026-07-11T09:00:00.000Z');
const TEN_DAYS_MS = 10 * MS_PER_DAY;

function makeSrsState(itemId: string, overrides: Partial<SRSState> = {}): SRSState {
  return {
    itemId,
    stability: 5,
    difficulty: 5,
    dueDate: '2026-07-05T09:00:00.000Z',
    fsrsState: 'review',
    reps: 3,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: 'guru',
    lastReviewedAt: '2026-06-30T09:00:00.000Z',
    updatedAt: '2026-06-30T09:00:00.000Z',
    ...overrides,
  };
}

let db: SQLiteDatabase;

beforeEach(async () => {
  __mockResetSqlite();
  db = await openDatabaseAsync('user.db');
  const result = runMigrations(db, [
    migration001Initial,
    migration002ItemStudyStatus,
    migration003SrsStatesAndImportMetadata,
    migration010SrsLastReviewedAt,
    migration011SrsLearningSteps,
    migration015GoalRingState,
  ]);
  expect(result.ok).toBe(true);
});

describe('vacation mode on/off', () => {
  it('is inactive by default', () => {
    expect(isVacationActive(db)).toBe(false);
  });

  it('stamps the start timestamp when enabled', () => {
    startVacation(db, VACATION_START);

    expect(isVacationActive(db)).toBe(true);
    expect(getVacationStartedAt(db)).toBe(VACATION_START.toISOString());
  });

  it('does not reset the clock when started again while already on', () => {
    startVacation(db, VACATION_START);
    startVacation(db, RESUME);

    expect(getVacationStartedAt(db)).toBe(VACATION_START.toISOString());
  });

  it('is a no-op when ended while already off', () => {
    const result = endVacation(db, RESUME);

    expect(result).toEqual({ ok: true, value: { shiftedCount: 0, days: 0 } });
  });

  it('turns off and reports the days paused', () => {
    startVacation(db, VACATION_START);

    const result = endVacation(db, RESUME);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.days).toBe(10);
    expect(isVacationActive(db)).toBe(false);
  });
});

describe('due-date shift on resume', () => {
  it('pushes a card due mid-vacation forward by the full break, preserving its spacing', () => {
    // Due on day 4 of a 10-day break; should land 4 days after resume.
    upsertSrsState(db, makeSrsState('1', { dueDate: '2026-07-05T09:00:00.000Z' }));
    startVacation(db, VACATION_START);

    endVacation(db, RESUME);

    expect(getSrsState(db, '1')?.dueDate).toBe(
      new Date(new Date('2026-07-05T09:00:00.000Z').getTime() + TEN_DAYS_MS).toISOString(),
    );
  });

  it('keeps the relative spread between cards so the backlog re-spreads over days', () => {
    upsertSrsState(db, makeSrsState('1', { dueDate: '2026-07-02T09:00:00.000Z' }));
    upsertSrsState(db, makeSrsState('2', { dueDate: '2026-07-09T09:00:00.000Z' }));
    startVacation(db, VACATION_START);

    endVacation(db, RESUME);

    const first = new Date(getSrsState(db, '1')!.dueDate).getTime();
    const second = new Date(getSrsState(db, '2')!.dueDate).getTime();
    expect(second - first).toBe(7 * MS_PER_DAY);
    // Neither is dumped at the moment of resume.
    expect(first).toBeGreaterThan(RESUME.getTime());
  });

  it('leaves cards that were already overdue when the break began', () => {
    const alreadyDue = '2026-06-28T09:00:00.000Z';
    upsertSrsState(db, makeSrsState('1', { dueDate: alreadyDue }));
    startVacation(db, VACATION_START);

    endVacation(db, RESUME);

    expect(getSrsState(db, '1')?.dueDate).toBe(alreadyDue);
  });

  it('moves last_reviewed_at by the same delta so FSRS sees the original gap', () => {
    upsertSrsState(
      db,
      makeSrsState('1', {
        dueDate: '2026-07-05T09:00:00.000Z',
        lastReviewedAt: '2026-06-30T09:00:00.000Z',
      }),
    );
    startVacation(db, VACATION_START);

    endVacation(db, RESUME);

    const state = getSrsState(db, '1')!;
    expect(state.lastReviewedAt).toBe(
      new Date(new Date('2026-06-30T09:00:00.000Z').getTime() + TEN_DAYS_MS).toISOString(),
    );
    // scheduled_days (due - lastReview) is unchanged by the break.
    expect(
      new Date(state.dueDate).getTime() - new Date(state.lastReviewedAt!).getTime(),
    ).toBe(5 * MS_PER_DAY);
  });

  it('survives a null last_reviewed_at', () => {
    upsertSrsState(
      db,
      makeSrsState('1', {
        dueDate: '2026-07-05T09:00:00.000Z',
        lastReviewedAt: null,
      }),
    );
    startVacation(db, VACATION_START);

    endVacation(db, RESUME);

    const state = getSrsState(db, '1')!;
    expect(state.lastReviewedAt).toBeNull();
    expect(state.dueDate).toBe(
      new Date(new Date('2026-07-05T09:00:00.000Z').getTime() + TEN_DAYS_MS).toISOString(),
    );
  });

  it('ignores burned cards', () => {
    const burnedDue = '2026-07-05T09:00:00.000Z';
    upsertSrsState(
      db,
      makeSrsState('1', {
        dueDate: burnedDue,
        isBurned: true,
        srsStageLabel: 'burned',
      }),
    );
    startVacation(db, VACATION_START);

    const result = endVacation(db, RESUME);

    expect(result.ok && result.value.shiftedCount).toBe(0);
    expect(getSrsState(db, '1')?.dueDate).toBe(burnedDue);
  });

  it('counts only the cards it actually shifted', () => {
    upsertSrsState(db, makeSrsState('1', { dueDate: '2026-07-05T09:00:00.000Z' }));
    upsertSrsState(db, makeSrsState('2', { dueDate: '2026-06-28T09:00:00.000Z' }));
    startVacation(db, VACATION_START);

    const result = endVacation(db, RESUME);

    expect(result.ok && result.value.shiftedCount).toBe(1);
  });

  it('shifts nothing when the clock moved backwards, but still turns vacation off', () => {
    const due = '2026-07-05T09:00:00.000Z';
    upsertSrsState(db, makeSrsState('1', { dueDate: due }));
    startVacation(db, VACATION_START);

    // Device clock earlier than the recorded start.
    const result = endVacation(db, new Date('2026-06-25T09:00:00.000Z'));

    expect(result.ok && result.value.shiftedCount).toBe(0);
    expect(getSrsState(db, '1')?.dueDate).toBe(due);
    expect(isVacationActive(db)).toBe(false);
  });
});

describe('goal ratchet on resume', () => {
  it('re-anchors the goal week so weeks away are never judged as missed', () => {
    setVacationStartedAt(db, VACATION_START.toISOString());

    endVacation(db, RESUME);

    // Monday of the week containing 2026-07-11 (a Saturday) is 2026-07-06.
    expect(getGoalRingState(db).goalWeekStart).toBe('2026-07-06');
    expect(getGoalRingState(db).consecutiveMissWeeks).toBe(0);
  });
});
