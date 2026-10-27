import type { SQLiteDatabase } from 'expo-sqlite';

import { parseConjugationClass } from '@/core/content/conjugation';
import type {
  AnswerUnit,
  AnswerUnitRole,
  BuildDiagnosisKey,
  DiagnosisWord,
  DiagnosisWordForm,
} from '@/core/grammar/mistakes/mistake.types';

type UnitRow = {
  answer_id: number | string | null;
  surface: string;
  reading: string;
  role: AnswerUnitRole;
  item_id: number | string | null;
  in_grammar: number;
};

type WordRow = {
  id: number | string;
  primary_form: string;
  furigana: string | null;
  conjugation_class: string | null;
  word_type: string | null;
  partner_primary_form: string | null;
  partner_furigana: string | null;
  partner_conjugation_class: string | null;
};

type HomophoneRow = {
  word_id: number | string;
  primary_form: string;
  furigana: string | null;
  conjugation_class: string | null;
};

function transitivityOf(wordType: string | null): DiagnosisWord['transitivity'] {
  if (wordType == null) return null;
  // "intransitive verb" contains "transitive verb"; \b keeps the test off its tail.
  const intransitive = /\bintransitive verb\b/.test(wordType);
  const transitive = /\btransitive verb\b/.test(wordType);
  // Tagged as both kinds: no single answer.
  if (intransitive && transitive) return null;
  if (intransitive) return 'intransitive';
  if (transitive) return 'transitive';
  return null;
}

/**
 * The cut answers of one Build sentence plus the facts about their words the
 * mistake diagnoser needs. `null` on a curriculum.db built before the units
 * table existed (that DB has no `items.transitivity_partner_id` either).
 */
export function getBuildDiagnosisKey(db: SQLiteDatabase, sentenceId: string): BuildDiagnosisKey | null {
  const hasTable = db.getAllSync(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'grammar_answer_units'",
  );
  if (hasTable.length === 0) return null;

  // Sentence units (answer_id NULL) first, then `valid` alternates in sort order.
  const unitRows = db.getAllSync<UnitRow>(
    `SELECT u.answer_id, u.surface, u.reading, u.role, u.item_id, u.in_grammar
     FROM grammar_answer_units u
     LEFT JOIN grammar_sentence_answers a ON a.id = u.answer_id
     WHERE u.sentence_id = ?
     ORDER BY u.answer_id IS NOT NULL, a.sort_order ASC, u.answer_id ASC, u.position ASC`,
    Number(sentenceId),
  );
  if (unitRows.length === 0) return null;

  const answers: AnswerUnit[][] = [];
  let currentAnswerId: number | string | null | undefined;
  for (const row of unitRows) {
    if (answers.length === 0 || row.answer_id !== currentAnswerId) {
      answers.push([]);
      currentAnswerId = row.answer_id;
    }
    answers[answers.length - 1].push({
      surface: row.surface,
      reading: row.reading,
      role: row.role,
      itemId: row.item_id == null ? null : String(row.item_id),
      inGrammar: row.in_grammar === 1,
    });
  }

  const wordIds = [...new Set(unitRows.flatMap((row) => (row.item_id == null ? [] : [Number(row.item_id)])))];
  const words: Record<string, DiagnosisWord> = {};
  if (wordIds.length === 0) return { answers, words };

  const placeholders = wordIds.map(() => '?').join(', ');
  const wordRows = db.getAllSync<WordRow>(
    `SELECT i.id, i.primary_form, i.furigana, i.conjugation_class, i.word_type,
            p.primary_form AS partner_primary_form, p.furigana AS partner_furigana,
            p.conjugation_class AS partner_conjugation_class
     FROM items i
     LEFT JOIN items p ON p.id = i.transitivity_partner_id
     WHERE i.id IN (${placeholders})`,
    ...wordIds,
  );
  // Readings live in accepted_answers (hiragana); a homophone is another
  // vocabulary item with an equal reading but a different written form.
  const homophoneRows = db.getAllSync<HomophoneRow>(
    `SELECT DISTINCT r.item_id AS word_id, h.primary_form, h.furigana, h.conjugation_class
     FROM accepted_answers r
     JOIN items w ON w.id = r.item_id
     JOIN accepted_answers hr
       ON hr.answer_type = 'reading' AND hr.answer_text = r.answer_text AND hr.item_id <> r.item_id
     JOIN items h ON h.id = hr.item_id AND h.item_type = 'vocabulary' AND h.primary_form <> w.primary_form
     WHERE r.answer_type = 'reading' AND r.item_id IN (${placeholders})
     ORDER BY h.sort_order ASC, h.id ASC`,
    ...wordIds,
  );

  const homophones = new Map<string, DiagnosisWordForm[]>();
  for (const row of homophoneRows) {
    const key = String(row.word_id);
    const list = homophones.get(key) ?? [];
    list.push({
      primaryForm: row.primary_form,
      furigana: row.furigana ?? null,
      conjugationClass: parseConjugationClass(row.conjugation_class),
    });
    homophones.set(key, list);
  }

  for (const row of wordRows) {
    const itemId = String(row.id);
    words[itemId] = {
      itemId,
      primaryForm: row.primary_form,
      furigana: row.furigana ?? null,
      conjugationClass: parseConjugationClass(row.conjugation_class),
      transitivity: transitivityOf(row.word_type),
      partner:
        row.partner_primary_form == null
          ? null
          : {
              primaryForm: row.partner_primary_form,
              furigana: row.partner_furigana ?? null,
              conjugationClass: parseConjugationClass(row.partner_conjugation_class),
            },
      homophones: homophones.get(itemId) ?? [],
    };
  }
  return { answers, words };
}
