import { useEffect, useState } from 'react';

import {
  getPassageById,
  getPassageQuestions,
  type PassageDetail,
  type PassageQuestion,
} from '@/data/curriculum/passageRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getPassagePracticeResults,
  type PassagePracticeResult,
} from '@/data/user/passagePracticeRepository';

export type PassageDetailResult = {
  passage: PassageDetail | null;
  questions: PassageQuestion[];
  practiceResults: PassagePracticeResult[];
  loading: boolean;
  notFound: boolean;
};

export function usePassageDetail(passageId: string | null): PassageDetailResult {
  const { curriculumDb, userDb } = useDatabase();
  const [passage, setPassage] = useState<PassageDetail | null>(null);
  const [questions, setQuestions] = useState<PassageQuestion[]>([]);
  const [practiceResults, setPracticeResults] = useState<PassagePracticeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!passageId) {
      setPassage(null);
      setQuestions([]);
      setPracticeResults([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const detail = getPassageById(curriculumDb, passageId);

    if (!detail) {
      setPassage(null);
      setQuestions([]);
      setPracticeResults([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPassage(detail);
    setQuestions(getPassageQuestions(curriculumDb, passageId));
    setPracticeResults(getPassagePracticeResults(userDb, passageId));
    setNotFound(false);
    setLoading(false);
  }, [curriculumDb, userDb, passageId]);

  const isDataStale = Boolean(passage && passageId && passage.id !== passageId);

  return {
    passage,
    questions,
    practiceResults,
    loading: loading || isDataStale,
    notFound,
  };
}
