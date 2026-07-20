import { useEffect, useState } from 'react';

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
  loading: boolean;
  notFound: boolean;
};

const NO_LINKS_UNLOCK: PassageUnlockStatus = {
  unlocked: false,
  linkedCount: 0,
  guruOrAboveCount: 0,
  coverage: 0,
  itemsRemainingToUnlock: 0,
};

export function usePassageDetail(passageId: string | null): PassageDetailResult {
  const { curriculumDb, userDb } = useDatabase();
  const [passage, setPassage] = useState<PassageDetail | null>(null);
  const [questions, setQuestions] = useState<PassageQuestion[]>([]);
  const [practiceResults, setPracticeResults] = useState<PassagePracticeResult[]>([]);
  const [wordSpans, setWordSpans] = useState<PassageWordSpan[]>([]);
  const [unlock, setUnlock] = useState<PassageUnlockStatus>(NO_LINKS_UNLOCK);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [neededItems, setNeededItems] = useState<CurriculumListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const reset = (): void => {
      setPassage(null);
      setQuestions([]);
      setPracticeResults([]);
      setWordSpans([]);
      setUnlock(NO_LINKS_UNLOCK);
      setIsUnlocked(false);
      setNeededItems([]);
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
    for (const [itemId, state] of getSrsStatesForItems(userDb, linkedIds)) {
      stageByItemId.set(itemId, state.srsStageLabel);
    }

    const status = computePassageUnlock(linkedIds, stageByItemId);
    const unlockedForReader = linkedIds.length === 0 || status.unlocked;

    setPassage(detail);
    setUnlock(status);
    setIsUnlocked(unlockedForReader);
    setNeededItems(
      unlockedForReader
        ? []
        : listItemSummariesByIds(
            curriculumDb,
            listNeededItemsForPassage(linkedIds, stageByItemId),
          ),
    );

    // A locked passage shows a to-do list, never comprehension practice, so
    // reader-only reads are skipped entirely while locked.
    setQuestions(unlockedForReader ? getPassageQuestions(curriculumDb, passageId) : []);
    setPracticeResults(unlockedForReader ? getPassagePracticeResults(userDb, passageId) : []);
    setWordSpans(unlockedForReader ? getPassageWordSpans(curriculumDb, passageId) : []);

    setNotFound(false);
    setLoading(false);
  }, [curriculumDb, userDb, passageId]);

  const isDataStale = Boolean(passage && passageId && passage.id !== passageId);

  return {
    passage,
    questions,
    practiceResults,
    wordSpans,
    unlock,
    isUnlocked,
    neededItems,
    loading: loading || isDataStale,
    notFound,
  };
}
