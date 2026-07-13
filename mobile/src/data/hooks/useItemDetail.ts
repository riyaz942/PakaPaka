import { useEffect, useState } from 'react';

import {
  getAcceptedAnswers,
  getExampleSentences,
  getGrammarLinksForVocab,
  getGrammarRule,
  getItemById,
  getKanjiReadings,
  getRelatedGrammarItems,
  type AcceptedAnswer,
  type CurriculumItemDetail,
  type ExampleSentence,
  type GrammarRule,
  type GrammarVocabLink,
  type KanjiReading,
  type RelatedGrammarItem,
} from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

export type ItemDetailResult = {
  item: CurriculumItemDetail | null;
  kanjiReadings: KanjiReading[] | null;
  acceptedAnswers: AcceptedAnswer[];
  grammarRule: GrammarRule | null;
  exampleSentences: ExampleSentence[];
  grammarVocabLinks: GrammarVocabLink[];
  relatedGrammar: RelatedGrammarItem[];
  loading: boolean;
  notFound: boolean;
};

export function useItemDetail(itemId: string | null): ItemDetailResult {
  const { curriculumDb } = useDatabase();
  const [item, setItem] = useState<CurriculumItemDetail | null>(null);
  const [kanjiReadings, setKanjiReadings] = useState<KanjiReading[] | null>(null);
  const [acceptedAnswers, setAcceptedAnswers] = useState<AcceptedAnswer[]>([]);
  const [grammarRule, setGrammarRule] = useState<GrammarRule | null>(null);
  const [exampleSentences, setExampleSentences] = useState<ExampleSentence[]>([]);
  const [grammarVocabLinks, setGrammarVocabLinks] = useState<GrammarVocabLink[]>([]);
  const [relatedGrammar, setRelatedGrammar] = useState<RelatedGrammarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      setKanjiReadings(null);
      setAcceptedAnswers([]);
      setGrammarRule(null);
      setExampleSentences([]);
      setGrammarVocabLinks([]);
      setRelatedGrammar([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const detail = getItemById(curriculumDb, itemId);

    if (!detail) {
      setItem(null);
      setKanjiReadings(null);
      setAcceptedAnswers([]);
      setGrammarRule(null);
      setExampleSentences([]);
      setGrammarVocabLinks([]);
      setRelatedGrammar([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setItem(detail);
    setNotFound(false);
    setAcceptedAnswers(getAcceptedAnswers(curriculumDb, itemId));
    setExampleSentences(getExampleSentences(curriculumDb, itemId));

    if (detail.itemType === 'kanji') {
      setKanjiReadings(getKanjiReadings(curriculumDb, itemId));
      setGrammarRule(null);
      setGrammarVocabLinks([]);
      setRelatedGrammar([]);
    } else if (detail.itemType === 'grammar') {
      setKanjiReadings(null);
      setGrammarRule(getGrammarRule(curriculumDb, itemId));
      setGrammarVocabLinks([]);
      setRelatedGrammar(getRelatedGrammarItems(curriculumDb, itemId));
    } else if (detail.itemType === 'vocabulary') {
      setKanjiReadings(null);
      setGrammarRule(null);
      setGrammarVocabLinks(getGrammarLinksForVocab(curriculumDb, itemId));
      setRelatedGrammar([]);
    } else {
      setKanjiReadings(null);
      setGrammarRule(null);
      setGrammarVocabLinks([]);
      setRelatedGrammar([]);
    }

    setLoading(false);
  }, [curriculumDb, itemId]);

  const isDataStale = Boolean(item && itemId && item.id !== itemId);

  return {
    item,
    kanjiReadings,
    acceptedAnswers,
    grammarRule,
    exampleSentences,
    grammarVocabLinks,
    relatedGrammar,
    loading: loading || isDataStale,
    notFound,
  };
}
