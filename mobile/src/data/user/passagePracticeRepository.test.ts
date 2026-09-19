import { openDatabaseAsync } from 'expo-sqlite';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { migration004PassagePracticeResults } from '@/data/migrations/004_passage_practice_results';
import { runMigrations } from '@/data/migrations/migrationRunner';
import {
  countPassagesWithResultsByIds,
  getPassagePracticeResults,
  upsertPassagePracticeResult,
} from '@/data/user/passagePracticeRepository';

describe('passagePracticeRepository', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  async function createUserDb() {
    const userDb = await openDatabaseAsync('user.db');
    const migrationResult = runMigrations(userDb, [migration004PassagePracticeResults]);
    expect(migrationResult.ok).toBe(true);
    return userDb;
  }

  it('upserts and reads back practice results for a passage', async () => {
    const userDb = await createUserDb();

    upsertPassagePracticeResult(userDb, {
      passageId: '1',
      questionId: '10',
      isCorrect: true,
      userAnswer: '学生',
      answeredAt: '2026-06-25T10:00:00.000Z',
    });

    expect(getPassagePracticeResults(userDb, '1')).toEqual([
      {
        passageId: '1',
        questionId: '10',
        isCorrect: true,
        userAnswer: '学生',
        answeredAt: '2026-06-25T10:00:00.000Z',
      },
    ]);
  });

  it('replaces prior result when the same passage and question are answered again', async () => {
    const userDb = await createUserDb();

    upsertPassagePracticeResult(userDb, {
      passageId: '1',
      questionId: '10',
      isCorrect: false,
      userAnswer: '先生',
      answeredAt: '2026-06-25T10:00:00.000Z',
    });

    upsertPassagePracticeResult(userDb, {
      passageId: '1',
      questionId: '10',
      isCorrect: true,
      userAnswer: '学生',
      answeredAt: '2026-06-25T10:05:00.000Z',
    });

    expect(getPassagePracticeResults(userDb, '1')).toEqual([
      {
        passageId: '1',
        questionId: '10',
        isCorrect: true,
        userAnswer: '学生',
        answeredAt: '2026-06-25T10:05:00.000Z',
      },
    ]);
  });

  it('counts distinct passages with at least one practice result', async () => {
    const userDb = await createUserDb();

    upsertPassagePracticeResult(userDb, {
      passageId: '1',
      questionId: '10',
      isCorrect: true,
      userAnswer: '学生',
    });
    upsertPassagePracticeResult(userDb, {
      passageId: '1',
      questionId: '11',
      isCorrect: false,
      userAnswer: '先生',
    });
    upsertPassagePracticeResult(userDb, {
      passageId: '2',
      questionId: '20',
      isCorrect: true,
      userAnswer: '学校',
    });

    expect(countPassagesWithResultsByIds(userDb, ['1', '2', '3'])).toBe(2);
  });

  it('returns 0 without querying when given no passage ids', async () => {
    const userDb = await createUserDb();
    expect(countPassagesWithResultsByIds(userDb, [])).toBe(0);
  });
});
