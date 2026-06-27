import type { SQLiteDatabase } from 'expo-sqlite';

export type PassagePracticeResult = {
  passageId: string;
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  answeredAt: string;
};

type PassagePracticeResultRow = {
  passage_id: number | string;
  question_id: number | string;
  is_correct: number;
  user_answer: string;
  answered_at: string;
};

function mapPracticeResultRow(row: PassagePracticeResultRow): PassagePracticeResult {
  return {
    passageId: String(row.passage_id),
    questionId: String(row.question_id),
    isCorrect: row.is_correct === 1,
    userAnswer: row.user_answer,
    answeredAt: row.answered_at,
  };
}

export function upsertPassagePracticeResult(
  userDb: SQLiteDatabase,
  result: Omit<PassagePracticeResult, 'answeredAt'> & { answeredAt?: string },
): void {
  const answeredAt = result.answeredAt ?? new Date().toISOString();
  userDb.runSync(
    `INSERT INTO passage_practice_results (passage_id, question_id, is_correct, user_answer, answered_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(passage_id, question_id) DO UPDATE SET
       is_correct = excluded.is_correct,
       user_answer = excluded.user_answer,
       answered_at = excluded.answered_at`,
    Number(result.passageId),
    Number(result.questionId),
    result.isCorrect ? 1 : 0,
    result.userAnswer,
    answeredAt,
  );
}

export function getPassagePracticeResults(
  userDb: SQLiteDatabase,
  passageId: string,
): PassagePracticeResult[] {
  const rows = userDb.getAllSync<PassagePracticeResultRow>(
    `SELECT passage_id, question_id, is_correct, user_answer, answered_at
     FROM passage_practice_results
     WHERE passage_id = ?`,
    Number(passageId),
  );
  return rows.map(mapPracticeResultRow);
}
