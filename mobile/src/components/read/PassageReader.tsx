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
  /** A spanned word reviewed today or yesterday, called out under the text. */
  recentWord: { itemId: string; surface: string; whenLabel: string } | null;
  onAnswerSubmitted: (result: PassagePracticeResult) => void;
};

export function PassageReader({
  passage,
  questions,
  practiceResults,
  wordSpans,
  recentWord,
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
      <Text accessibilityRole="header" className="text-title-lg font-jp-bold text-primary">
        {passage.title}
      </Text>

      {/* Bilingual one-liner (FR66) framing what the passage is about. */}
      {passage.summaryJa ? (
        <Text className="mt-space-xs text-body-sm font-jp-medium text-secondary">
          {passage.summaryJa}
        </Text>
      ) : null}
      {passage.summaryEn ? (
        <Text className="mt-space-xs text-caption font-ui text-muted">{passage.summaryEn}</Text>
      ) : null}

      <View className="mt-space-md">
        <PassageBody
          body={passage.body}
          bodyFurigana={passage.bodyFurigana}
          wordSpans={wordSpans}
          onWordPress={handleWordPress}
        />
      </View>

      {recentWord ? (
        <View
          testID="passage-recent-word"
          className="mt-space-md flex-row items-center gap-space-sm rounded-radius-md bg-content-vocabulary-soft px-space-md py-space-sm">
          <View className="h-[8px] w-[8px] rounded-radius-full bg-content-vocabulary" />
          <Text className="flex-1 text-caption font-ui-semibold text-content-vocabulary-deep">
            {recentWord.surface} — you reviewed this {recentWord.whenLabel}
          </Text>
        </View>
      ) : null}

      {questions.length > 0 ? (
        <View className="mt-space-lg gap-space-md">
          {questions.map((question, index) => (
            <PassageQuestion
              key={question.id}
              passageId={passage.id}
              question={question}
              position={index + 1}
              total={questions.length}
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
