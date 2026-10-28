import type { SQLiteDatabase } from 'expo-sqlite';

import { pickGrammarSentences } from '@/core/grammar/sentencePicker';
import type { GrammarSentenceCard, GrammarVocabEntry } from '@/core/srs/srs.types';
import { getBuildDiagnosisKey } from '@/data/curriculum/grammarAnswerUnitsRepository';
import {
  getGrammarSentencePool,
  getItemFormsByIds,
  type GrammarPoolSentence,
} from '@/data/curriculum/grammarPoolRepository';
import { getGrammarSentenceHistory, listGrammarAnswers } from '@/data/user/grammarAnswerRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';

/**
 * The Read and Build sentences for one due grammar item (spec §5.3): two
 * pool sentences the previous review did not use, each with its word list,
 * answers and the learner's saved answers.
 */
export function buildGrammarCards(
  curriculumDb: SQLiteDatabase,
  userDb: SQLiteDatabase,
  itemId: string,
  rng: () => number = Math.random,
): { grammarRead: GrammarSentenceCard; grammarBuild: GrammarSentenceCard } {
  const pool = getGrammarSentencePool(curriculumDb, itemId);
  const { read, build } = pickGrammarSentences(pool, getGrammarSentenceHistory(userDb, itemId), rng);
  const saved = listGrammarAnswers(userDb, itemId);

  const wordIds = [...new Set([read, build].flatMap((s) => s.spans.map((span) => span.vocabularyItemId)))];
  const forms = getItemFormsByIds(curriculumDb, wordIds);
  const statuses = listStudyStatusesForItems(userDb, wordIds);

  const toCard = (sentence: GrammarPoolSentence, withDiagnosis: boolean): GrammarSentenceCard => {
    const vocabulary: GrammarVocabEntry[] = [];
    const seen = new Set<string>();
    const inOrder = [...sentence.spans].sort((a, b) => a.startOffset - b.startOffset);
    for (const span of inOrder) {
      if (seen.has(span.vocabularyItemId)) continue;
      seen.add(span.vocabularyItemId);
      const form = forms.get(span.vocabularyItemId);
      // Spans reference items(id) in curriculum.db; a miss is a broken compile.
      if (!form) throw new Error(`Grammar sentence word ${span.vocabularyItemId} has no item row`);
      const status = statuses.get(span.vocabularyItemId);
      vocabulary.push({
        itemId: span.vocabularyItemId,
        primaryForm: form.primaryForm,
        furigana: form.furigana,
        started: status === 'in_progress' || status === 'known',
      });
    }
    return {
      sentenceKey: sentence.japanese,
      japanese: sentence.japanese,
      furigana: sentence.furigana,
      english: sentence.english,
      spans: sentence.spans,
      grammarSpan: { start: sentence.grammarStart, end: sentence.grammarEnd },
      register: sentence.register,
      vocabulary,
      answers: [sentence.furigana ?? sentence.japanese, ...sentence.validAnswers],
      otherGrammarAnswers: sentence.otherGrammarAnswers,
      userAnswers: [...(saved.get(sentence.japanese) ?? [])],
      diagnosisKey: withDiagnosis ? getBuildDiagnosisKey(curriculumDb, sentence.id) : null,
    };
  };

  return { grammarRead: toCard(read, false), grammarBuild: toCard(build, true) };
}
