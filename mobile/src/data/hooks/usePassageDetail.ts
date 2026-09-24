import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listNeededItemsForPassage } from '@/core/content/passageNeededItems';
import { computePassageUnlock, type PassageUnlockStatus } from '@/core/content/passageUnlock';
import {
  getPassageById,
  getPassageLinkedItemIds,
  getPassageQuestions,
  type PassageDetail,
  type PassageQuestion,
} from '@/data/curriculum/passageRepository';
import {
  getPassageWordSpans,
  type PassageWordSpan,
} from '@/data/curriculum/passageSpans';
import {
  listItemSummariesByIds,
  type CurriculumListItem,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { todayKey } from '@/data/user/cognitiveLoadRepository';
import { listKnownItemIds } from '@/data/user/itemStudyStatusRepository';
import { getSrsStatesForItems } from '@/data/user/srsStateRepository';
import {
  getPassagePracticeResults,
  type PassagePracticeResult,
} from '@/data/user/passagePracticeRepository';

import type { SRSStageLabel } from '@/core/srs/srs.types';

export type PassageDetailResult = {
  passage: PassageDetail | null;
  questions: PassageQuestion[];
  practiceResults: PassagePracticeResult[];
  /** Authored word boundaries for in-place lookup (FR70). */
  wordSpans: PassageWordSpan[];
  /** Derived FR68 unlock — never persisted. */
  unlock: PassageUnlockStatus;
  /**
   * True when the reader should be shown. Mirrors Browse's empty-link policy:
   * a passage with no authored links opens as a reader rather than a padlock
   * the learner cannot act on.
   */
  isUnlocked: boolean;
  /** Linked vocab/grammar still below Guru, for the locked to-do list (FR69). */
  neededItems: CurriculumListItem[];
  /**
   * Display-only: the first spanned word in the body the learner reviewed today
   * or yesterday, for the reader's "you saw this recently" callout. Read off the
   * SRS rows already loaded for unlock — no extra query, and no claim the data
   * cannot back (see the plan's Session 5 deviation on the spec's wording).
   */
  recentWord: { itemId: string; surface: string; whenLabel: string } | null;
  loading: boolean;
  notFound: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const NO_LINKS_UNLOCK: PassageUnlockStatus = {
  unlocked: false,
  linkedCount: 0,
  guruOrAboveCount: 0,
  coverage: 0,
  itemsRemainingToUnlock: 0,
};

/**
 * First spanned word reviewed today or yesterday. Anything older is left alone
 * — "recently" stops meaning anything past a day or two, and the callout is
 * only worth showing when it is a genuine "oh, that one" moment.
 */
function findRecentWord(
  spans: PassageWordSpan[],
  lastReviewedByItemId: ReadonlyMap<string, string>,
  body: string,
  now = new Date(),
): PassageDetailResult['recentWord'] {
  const today = todayKey(now);
  const yesterday = todayKey(new Date(now.getTime() - DAY_IN_MS));

  for (const span of spans) {
    const reviewedAt = lastReviewedByItemId.get(span.vocabularyItemId);
    if (!reviewedAt) continue;

    const day = todayKey(new Date(reviewedAt));
    const whenLabel = day === today ? 'earlier today' : day === yesterday ? 'yesterday' : null;
    if (!whenLabel) continue;

    return {
      itemId: span.vocabularyItemId,
      surface: body.slice(span.startOffset, span.endOffset),
      whenLabel,
    };
  }

  return null;
}

export function usePassageDetail(passageId: string | null): PassageDetailResult {
  const { curriculumDb, userDb } = useDatabase();
  const [passage, setPassage] = useState<PassageDetail | null>(null);
  const [questions, setQuestions] = useState<PassageQuestion[]>([]);
  const [practiceResults, setPracticeResults] = useState<PassagePracticeResult[]>([]);
  const [wordSpans, setWordSpans] = useState<PassageWordSpan[]>([]);
  const [unlock, setUnlock] = useState<PassageUnlockStatus>(NO_LINKS_UNLOCK);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [neededItems, setNeededItems] = useState<CurriculumListItem[]>([]);
  const [recentWord, setRecentWord] = useState<PassageDetailResult['recentWord']>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    const reset = (): void => {
      setPassage(null);
      setQuestions([]);
      setPracticeResults([]);
      setWordSpans([]);
      setUnlock(NO_LINKS_UNLOCK);
      setIsUnlocked(false);
      setNeededItems([]);
      setRecentWord(null);
      setNotFound(true);
      setLoading(false);
    };

    if (!passageId) {
      reset();
      return;
    }

    setLoading(true);
    const detail = getPassageById(curriculumDb, passageId);

    if (!detail) {
      reset();
      return;
    }

    const linkedIds = getPassageLinkedItemIds(curriculumDb, passageId);
    const stageByItemId = new Map<string, SRSStageLabel>();
    const lastReviewedByItemId = new Map<string, string>();
    for (const [itemId, state] of getSrsStatesForItems(userDb, linkedIds)) {
      stageByItemId.set(itemId, state.srsStageLabel);
      if (state.lastReviewedAt) lastReviewedByItemId.set(itemId, state.lastReviewedAt);
    }

    const knownItemIds = listKnownItemIds(userDb, linkedIds);

    const status = computePassageUnlock(linkedIds, stageByItemId, knownItemIds);
    const unlockedForReader = linkedIds.length === 0 || status.unlocked;

    setPassage(detail);
    setUnlock(status);
    setIsUnlocked(unlockedForReader);
    setNeededItems(
      unlockedForReader
        ? []
        : listItemSummariesByIds(
            curriculumDb,
            listNeededItemsForPassage(linkedIds, stageByItemId, knownItemIds),
          ),
    );

    // A locked passage shows a to-do list, never comprehension practice, so
    // reader-only reads are skipped entirely while locked.
    setQuestions(unlockedForReader ? getPassageQuestions(curriculumDb, passageId) : []);
    setPracticeResults(unlockedForReader ? getPassagePracticeResults(userDb, passageId) : []);

    const spans = unlockedForReader ? getPassageWordSpans(curriculumDb, passageId) : [];
    setWordSpans(spans);

    setRecentWord(findRecentWord(spans, lastReviewedByItemId, detail.body));

    setNotFound(false);
    setLoading(false);
  }, [curriculumDb, userDb, passageId]);

  // Refetch on every focus: returning from a needed-item /browse/item/[id]
  // (or a lesson/review) can change SRS stages and unlock the reader.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isDataStale = Boolean(passage && passageId && passage.id !== passageId);

  return {
    passage,
    questions,
    practiceResults,
    wordSpans,
    unlock,
    isUnlocked,
    neededItems,
    recentWord,
    loading: loading || isDataStale,
    notFound,
  };
}
