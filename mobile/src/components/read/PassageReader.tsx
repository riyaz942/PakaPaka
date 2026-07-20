import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { PassageBody } from '@/components/read/PassageBody';
import { PassageQuestion } from '@/components/read/PassageQuestion';
import { PassageWordDetailSheet } from '@/components/read/PassageWordDetailSheet';
import {
  getItemById,
  type CurriculumItemDetail,
} from '@/data/curriculum/itemRepository';
import type {
  PassageDetail,
  PassageQuestion as PassageQuestionType,
} from '@/data/curriculum/passageRepository';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';
import { useDatabase } from '@/data/hooks/useDatabase';
import type { PassagePracticeResult } from '@/data/user/passagePracticeRepository';

type PassageReaderProps = {
  passage: PassageDetail;
  questions: PassageQuestionType[];
  practiceResults: PassagePracticeResult[];
  wordSpans: PassageWordSpan[];
  onAnswerSubmitted: (result: PassagePracticeResult) => void;
};

export function PassageReader({
  passage,
  questions,
  practiceResults,
  wordSpans,
  onAnswerSubmitted,
}: PassageReaderProps) {
  const { curriculumDb } = useDatabase();
  const practiceByQuestionId = new Map(
    practiceResults.map((result) => [result.questionId, result]),
  );

  const [selectedWord, setSelectedWord] = useState<{
    item: CurriculumItemDetail | null;
    surface: string;
  } | null>(null);

  const handleWordPress = useCallback(
    (vocabularyItemId: string, surface: string) => {
      setSelectedWord({ item: getItemById(curriculumDb, vocabularyItemId), surface });
    },
    [curriculumDb],
  );

  return (
    <View testID="passage-reader">
      <Text className="text-title text-primary">{passage.title}</Text>

      {/* Bilingual one-liner (FR66) framing what the passage is about. */}
      {passage.summaryJa ? (
        <Text className="mt-space-sm text-body text-primary">{passage.summaryJa}</Text>
      ) : null}
      {passage.summaryEn ? (
        <Text className="mt-space-xs text-body-sm text-secondary">{passage.summaryEn}</Text>
      ) : null}

      <View className="mt-4">
        <PassageBody
          body={passage.body}
          bodyFurigana={passage.bodyFurigana}
          wordSpans={wordSpans}
          onWordPress={handleWordPress}
        />
      </View>

      {questions.length > 0 ? (
        <View className="mt-8 gap-space-lg">
          <Text className="text-body font-semibold text-primary">Comprehension</Text>
          {questions.map((question) => (
            <PassageQuestion
              key={question.id}
              passageId={passage.id}
              question={question}
              savedResult={practiceByQuestionId.get(question.id) ?? null}
              onAnswerSubmitted={onAnswerSubmitted}
            />
          ))}
        </View>
      ) : null}

      <PassageWordDetailSheet
        item={selectedWord?.item ?? null}
        surface={selectedWord?.surface ?? null}
        visible={selectedWord !== null}
        onDismiss={() => setSelectedWord(null)}
      />
    </View>
  );
}
