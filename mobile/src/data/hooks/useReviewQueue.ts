import { useCallback, useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import { QUEUE_FETCH_LIMIT } from '@/config/constants';
import { deriveMeaningCandidates } from '@/core/answer/meaningEvaluator';
import { normalizeKana } from '@/core/answer/readingEvaluator';
import { isItemUnlocked } from '@/core/content/dependencyGraph';
import type { ReinforcementSrsSnapshot } from '@/core/content/content.types';
import { resolveReinforcement } from '@/core/content/reinforcementResolver';
import { buildGrammarCloze } from '@/core/grammar/clozeBuilder';
import {
  buildMcOptions,
  INTERIM_PARTICLE_POOL,
  pickGrammarDistractors,
} from '@/core/grammar/distractors';
import { resolveGrammarInputMode, type GrammarInputMode } from '@/core/grammar/inputMode';
import type { ReviewAnswerKey, ReviewItem, SRSState } from '@/core/srs/srs.types';
import { buildReviewQueue } from '@/core/srs/queueBuilder';
import type { QueueInputItem } from '@/core/srs/queueBuilder';
import {
  getItemById,
  getRelatedItemsForItems,
  getRequiredParentsForItems,
  getAcceptedAnswers,
  getExampleSentences,
  getKanjiReadings,
  getGrammarRule,
  getGrammarClozeVariants,
  getGrammarDistractorPools,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getPersonalMnemonic } from '@/data/user/mnemonicRepository';
import { listSynonymsForItems, type UserSynonym } from '@/data/user/userSynonymRepository';
import { listStudyStatusesForItems } from '@/data/user/itemStudyStatusRepository';
import { getBoosts } from '@/data/user/relatedItemBoostRepository';
import { getWeaknessBiasEnabled } from '@/data/user/preferencesRepository';
import { getWeaknessScores } from '@/data/user/weaknessRepository';
import {
  applyReviewPriority,
  clearReviewPriority,
  getReviewPriority,
} from '@/data/reviewPriorityStore';
import {
  getDueSrsStates,
  getSrsStatesForItems,
  seedMissingSrsStatesForInProgress,
} from '@/data/user/srsStateRepository';
import type { AppError } from '@/types/result.types';

type UseReviewQueueResult = {
  queue: ReviewItem[];
  isLoading: boolean;
  error: AppError | null;
  refetch: () => void;
  queueBuildMs: number | null;
};

export function buildAnswerKey(
  curriculumDb: SQLiteDatabase,
  itemId: string,
  itemType: 'radical' | 'kanji' | 'vocabulary' | 'grammar',
  displayMeaning: string,
  userSynonyms: UserSynonym[],
): { answerKey: ReviewAnswerKey; kanjiHasOnyomi: boolean } {
  const acceptedAnswers = getAcceptedAnswers(curriculumDb, itemId);

  // Many items (radicals, most grammar) have no accepted_answers rows, and the
  // display meaning packs alternatives ("hole / cave") — derive candidates from
  // it so a correct answer is never rejected on a seed-data gap. User-added
  // synonyms are a third source on top of both.
  const acceptedMeanings = [
    ...new Set([
      ...acceptedAnswers
        .filter((a) => a.answerType === 'meaning')
        .map((a) => a.answerText),
      ...deriveMeaningCandidates(displayMeaning),
      ...userSynonyms
        .filter((s) => s.answerType === 'meaning')
        .map((s) => s.answerText),
    ]),
  ];

  let acceptedReadings = acceptedAnswers
    .filter((a) => a.answerType === 'reading' || a.answerType === 'production')
    .map((a) => a.answerText);

  const userReadings = userSynonyms
    .filter((s) => s.answerType === 'reading')
    .map((s) => s.answerText);

  let alternateReadings: string[] | undefined;
  let kanjiHasOnyomi = false;
  if (itemType === 'kanji') {
    // BUG3 fix (FR81/FR5): the kanji reading card validates on'yomi only.
    // Kun'yomi rows are carried as alternates so the evaluator can nudge with
    // wrong_reading_type — never merged into the accepted set. Untyped
    // accepted_answers readings are dropped for kanji for the same reason.
    const kanjiReadings = getKanjiReadings(curriculumDb, itemId);
    const onyomi = kanjiReadings
      .filter((r) => r.readingType === 'onyomi')
      .map((r) => r.reading)
      .filter((reading) => normalizeKana(reading).length > 0);
    const kunyomi = kanjiReadings
      .filter((r) => r.readingType === 'kunyomi')
      .map((r) => r.reading)
      .filter((reading) => normalizeKana(reading).length > 0);
    kanjiHasOnyomi = onyomi.length > 0;
    acceptedReadings = [...new Set([...onyomi, ...userReadings])];
    const acceptedNormalized = new Set(acceptedReadings.map((r) => normalizeKana(r)));
    alternateReadings = [...new Set(kunyomi)].filter(
      (reading) => !acceptedNormalized.has(normalizeKana(reading)),
    );
  } else if (userReadings.length > 0) {
    acceptedReadings = [...new Set([...acceptedReadings, ...userReadings])];
  }

  let grammar: ReviewAnswerKey['grammar'];
  if (itemType === 'grammar') {
    const rule = getGrammarRule(curriculumDb, itemId);
    if (rule) {
      grammar = {
        structure: rule.structure,
        conjugationRules: rule.conjugationRules,
        acceptedForms: rule.acceptedForms,
      };
    }
  }

  return {
    answerKey: { acceptedMeanings, acceptedReadings, alternateReadings, grammar },
    kanjiHasOnyomi,
  };
}

function getInProgressItemIds(userDb: import('expo-sqlite').SQLiteDatabase): string[] {
  const rows = userDb.getAllSync<{ item_id: number }>(
    `SELECT item_id FROM item_study_status WHERE status = 'in_progress'`,
  );
  return rows.map((row) => String(row.item_id));
}

function toReinforcementSnapshot(state: SRSState): ReinforcementSrsSnapshot {
  return {
    srsStageLabel: state.srsStageLabel,
    updatedAt: state.updatedAt,
    fsrsState: state.fsrsState,
    reps: state.reps,
  };
}

export function useReviewQueue(): UseReviewQueueResult {
  const { curriculumDb, userDb } = useDatabase();
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [queueBuildMs, setQueueBuildMs] = useState<number | null>(null);
  const [buildCount, setBuildCount] = useState(0);

  const buildQueue = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const t0 = Date.now();

      const inProgressIds = getInProgressItemIds(userDb);
      if (inProgressIds.length > 0) {
        const seedResult = seedMissingSrsStatesForInProgress(userDb, inProgressIds);
        if (!seedResult.ok) {
          setError(seedResult.error);
          setQueue([]);
          setIsLoading(false);
          return;
        }
      }

      const now = new Date();
      let dueSrsStates = getDueSrsStates(userDb, now, QUEUE_FETCH_LIMIT);

      // Home triage handoff (FR59/FR61): a one-shot priority hint narrows the
      // candidate set and/or caps session size. Cleared only after the queue
      // successfully materializes so a failed build can retry the same hint.
      const priority = getReviewPriority();
      let preferredStates: typeof dueSrsStates = [];
      if (priority && priority.itemIds.length > 0) {
        const preferredMap = getSrsStatesForItems(userDb, priority.itemIds);
        preferredStates = priority.itemIds
          .map((id) => preferredMap.get(id))
          .filter((state): state is (typeof dueSrsStates)[number] =>
            state != null && !state.isBurned,
          );
      }
      dueSrsStates = applyReviewPriority(dueSrsStates, priority, preferredStates);

      if (dueSrsStates.length === 0) {
        const elapsed = Date.now() - t0;
        setQueueBuildMs(elapsed);
        setQueue([]);
        if (priority) clearReviewPriority();
        setIsLoading(false);
        return;
      }

      const itemIds = dueSrsStates.map((s) => s.itemId);

      const parentsMap = getRequiredParentsForItems(curriculumDb, itemIds);
      const relatedItemsMap = getRelatedItemsForItems(curriculumDb, itemIds);
      const boostMap = getBoosts(userDb, itemIds);
      const synonymMap = listSynonymsForItems(userDb, itemIds);
      // Read weakness bias preference and scores in one batched query (mirrors getBoosts).
      const weaknessBiasEnabled = getWeaknessBiasEnabled(userDb);
      const weaknessScoreMap = weaknessBiasEnabled ? getWeaknessScores(userDb, itemIds) : new Map<string, number>();

      const allRelatedIds = [
        ...new Set(
          Array.from(relatedItemsMap.values())
            .flat()
            .map((r) => r.id),
        ),
      ];
      const relatedSrsMap = getSrsStatesForItems(userDb, allRelatedIds);

      const allParentIds = Array.from(parentsMap.values())
        .flat()
        .map((p) => p.id);
      const uniqueParentIds = [...new Set(allParentIds)];
      const parentStatuses = listStudyStatusesForItems(userDb, uniqueParentIds);
      const studyStatusMap = listStudyStatusesForItems(userDb, itemIds);

      const queueInputs: QueueInputItem[] = [];
      for (const srsState of dueSrsStates) {
        const curriculumItem = getItemById(curriculumDb, srsState.itemId);
        if (!curriculumItem) {
          if (__DEV__) {
            console.warn(
              `[ReviewQueue] Skipping due SRS item ${srsState.itemId}: no curriculum row`,
            );
          }
          continue;
        }

        const parents = parentsMap.get(srsState.itemId) ?? [];
        const studyStatus = studyStatusMap.get(srsState.itemId) ?? null;

        if (!isItemUnlocked(parents, parentStatuses)) continue;

        const relatedItems = relatedItemsMap.get(srsState.itemId) ?? [];
        const srsSnapshotMap = new Map<string, ReinforcementSrsSnapshot | null>();
        for (const related of relatedItems) {
          const relatedSrs = relatedSrsMap.get(related.id);
          srsSnapshotMap.set(related.id, relatedSrs ? toReinforcementSnapshot(relatedSrs) : null);
        }

        const reinforcementLinks = resolveReinforcement(
          { itemId: srsState.itemId, itemType: curriculumItem.itemType },
          relatedItems,
          srsSnapshotMap,
          { now },
        );

        const personalMnemonic = getPersonalMnemonic(userDb, srsState.itemId);
        const { answerKey, kanjiHasOnyomi } = buildAnswerKey(
          curriculumDb,
          srsState.itemId,
          curriculumItem.itemType,
          curriculumItem.meaning,
          synonymMap.get(srsState.itemId) ?? [],
        );
        if (__DEV__ && curriculumItem.itemType === 'kanji' && !kanjiHasOnyomi) {
          console.warn(
            `[ReviewQueue] Kanji ${srsState.itemId} has no on'yomi rows — emitting meaning card only`,
          );
        }

        // Grammar cloze contract (Plan 07): the review prompt is a sentence
        // with the grammar chunk blanked, never the bare form itself.
        // Authored variants (Plan 09) win; sentence derivation is the fallback.
        let clozePrompt: string | null = null;
        let clozeAnswer: string | null = null;
        let clozeNudge: string | null = null;
        let clozeEnglish: string | null = null;
        let inputMode: GrammarInputMode | undefined;
        let mcOptions: string[] | null = null;
        if (curriculumItem.itemType === 'grammar' && answerKey.grammar) {
          const variants = getGrammarClozeVariants(curriculumDb, srsState.itemId);
          if (variants.length > 0) {
            const variant = variants[Math.floor(Math.random() * variants.length)];
            clozePrompt = variant.jpCloze;
            clozeAnswer = variant.answer;
            clozeNudge = variant.nudge || null;
            clozeEnglish = variant.english || null;
          } else {
            const examples = getExampleSentences(curriculumDb, srsState.itemId);
            const cloze = buildGrammarCloze({
              exampleSentences: examples,
              acceptedForms: answerKey.grammar.acceptedForms,
              structure: answerKey.grammar.structure,
            });
            clozePrompt = cloze?.prompt ?? null;
            // Interim hint rung 2 (Plan 10): first example sentence's English.
            clozeEnglish = examples[0]?.english ?? null;
          }

          // Stage ladder (Plan 08): apprentice answers by multiple choice.
          inputMode = resolveGrammarInputMode(srsState.srsStageLabel);
          if (inputMode === 'mc') {
            const answer = clozeAnswer ?? answerKey.grammar.acceptedForms[0];
            const pools = getGrammarDistractorPools(curriculumDb, srsState.itemId);
            // Any accepted form of THIS item would grade correct if picked, so
            // none of them may appear as a distractor.
            const accepted = new Set(answerKey.grammar.acceptedForms);
            const withoutAccepted = (forms: string[]) =>
              forms.filter((form) => !accepted.has(form));
            const familyCandidates =
              pools.familyForms.length > 0
                ? pools.familyForms
                : INTERIM_PARTICLE_POOL.includes(
                      answer as (typeof INTERIM_PARTICLE_POOL)[number],
                    )
                  ? [...INTERIM_PARTICLE_POOL]
                  : [];
            const distractors = pickGrammarDistractors({
              answer,
              familyCandidates: withoutAccepted(familyCandidates),
              fallbackPool: withoutAccepted(pools.levelForms),
            });
            mcOptions = buildMcOptions(answer, distractors);
            // No usable distractors: an MC card with one option teaches
            // nothing, so fall back to type-in.
            if (!mcOptions) inputMode = 'type_in';
          }
        }

        queueInputs.push({
          srsState,
          curriculumItem,
          parents,
          parentStatuses,
          studyStatus,
          personalMnemonic,
          answerKey,
          clozePrompt,
          clozeAnswer,
          clozeNudge,
          clozeEnglish,
          inputMode,
          mcOptions,
          kanjiHasOnyomi,
          boost: boostMap.get(srsState.itemId) ?? 0,
          relatedItems,
          reinforcementLink: reinforcementLinks[0] ?? null,
        });
      }

      const built = buildReviewQueue(queueInputs, {
        now,
        weaknessScores: weaknessScoreMap,
        weaknessBiasEnabled,
      });
      const elapsed = Date.now() - t0;

      if (__DEV__ && elapsed > 100) {
        console.warn(`[ReviewQueue] queueBuildMs=${elapsed}ms exceeds 100ms budget`);
      }

      // Boosts are consumed when an item is actually graded (ReviewSessionProvider),
      // not at build time — backing out of a session must not discard them.

      setQueueBuildMs(elapsed);
      setQueue(built);
      if (priority) clearReviewPriority();
    } catch (cause) {
      setError({
        code: 'queue_build_failed',
        message: 'Failed to build review queue',
        cause,
      });
    } finally {
      setIsLoading(false);
    }
  }, [curriculumDb, userDb]);

  useEffect(() => {
    buildQueue();
  }, [buildQueue, buildCount]);

  const refetch = useCallback(() => {
    setBuildCount((c) => c + 1);
  }, []);

  return { queue, isLoading, error, refetch, queueBuildMs };
}
