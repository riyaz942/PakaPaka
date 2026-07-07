import type { SQLiteDatabase } from 'expo-sqlite';

import type { JLPTLevel } from '@/data/curriculum/curriculum.types';

export type PassageListItem = {
  id: string;
  title: string;
  jlptLevel: JLPTLevel;
  sortOrder: number;
  questionCount: number;
};

export type PassageDetail = {
  id: string;
  title: string;
  body: string;
  bodyFurigana: string | null;
  jlptLevel: JLPTLevel;
  sortOrder: number;
};

export type PassageQuestion = {
  id: string;
  passageId: string;
  prompt: string;
  promptFurigana: string | null;
  acceptedAnswers: string[];
  sortOrder: number;
};

type PassageListRow = {
  id: number | string;
  title: string;
  jlpt_level: JLPTLevel;
  sort_order: number;
  question_count: number;
};

type PassageDetailRow = {
  id: number | string;
  title: string;
  body: string;
  body_furigana: string | null;
  jlpt_level: JLPTLevel;
  sort_order: number;
};

type PassageQuestionRow = {
  id: number | string;
  passage_id: number | string;
  prompt: string;
  prompt_furigana: string | null;
  accepted_answers: string;
  sort_order: number;
};

function mapPassageListRow(row: PassageListRow): PassageListItem {
  return {
    id: String(row.id),
    title: row.title,
    jlptLevel: row.jlpt_level,
    sortOrder: row.sort_order,
    questionCount: row.question_count,
  };
}

function mapPassageDetailRow(row: PassageDetailRow): PassageDetail {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    bodyFurigana: row.body_furigana ?? null,
    jlptLevel: row.jlpt_level,
    sortOrder: row.sort_order,
  };
}

export function listPassagesByLevel(
  db: SQLiteDatabase,
  jlptLevel: JLPTLevel,
): PassageListItem[] {
  const rows = db.getAllSync<PassageListRow>(
    `SELECT rp.id, rp.title, rp.jlpt_level, rp.sort_order,
            (SELECT COUNT(*) FROM passage_questions pq WHERE pq.passage_id = rp.id) AS question_count
     FROM reading_passages rp
     WHERE rp.jlpt_level = ?
     ORDER BY rp.sort_order ASC`,
    jlptLevel,
  );
  return rows.map(mapPassageListRow);
}

export function getPassageById(db: SQLiteDatabase, id: string): PassageDetail | null {
  const row = db.getFirstSync<PassageDetailRow>(
    `SELECT id, title, body, body_furigana, jlpt_level, sort_order FROM reading_passages WHERE id = ?`,
    Number(id),
  );
  return row ? mapPassageDetailRow(row) : null;
}

export function getPassageQuestions(db: SQLiteDatabase, passageId: string): PassageQuestion[] {
  const rows = db.getAllSync<PassageQuestionRow>(
    `SELECT id, passage_id, prompt, prompt_furigana, accepted_answers, sort_order
     FROM passage_questions WHERE passage_id = ? ORDER BY sort_order ASC`,
    Number(passageId),
  );
  return rows.map((row) => ({
    id: String(row.id),
    passageId: String(row.passage_id),
    prompt: row.prompt,
    promptFurigana: row.prompt_furigana ?? null,
    acceptedAnswers: JSON.parse(row.accepted_answers) as string[],
    sortOrder: row.sort_order,
  }));
}
