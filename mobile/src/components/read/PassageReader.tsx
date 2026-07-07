import React from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { PassageQuestion } from '@/components/read/PassageQuestion';
import type { PassageDetail, PassageQuestion as PassageQuestionType } from '@/data/curriculum/passageRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import type { PassagePracticeResult } from '@/data/user/passagePracticeRepository';

type PassageReaderProps = {
  passage: PassageDetail;
  questions: PassageQuestionType[];
  practiceResults: PassagePracticeResult[];
  onAnswerSubmitted: (result: PassagePracticeResult) => void;
};

export function PassageReader({
  passage,
  questions,
  practiceResults,
  onAnswerSubmitted,
}: PassageReaderProps) {
  const practiceByQuestionId = new Map(
    practiceResults.map((result) => [result.questionId, result]),
  );
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();

  return (
    <View testID="passage-reader">
      <Text className="text-title text-primary">{passage.title}</Text>
      <View className="mt-4">
        <FuriganaText
          text={passage.bodyFurigana ?? passage.body}
          mode={furiganaMode}
          knownKanji={knownKanji}
          className="text-body-lg text-primary"
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
    </View>
  );
}
