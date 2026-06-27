import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { evaluatePassageAnswer } from '@/core/answer/evaluatePassageAnswer';
import type { PassageQuestion as PassageQuestionType } from '@/data/curriculum/passageRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  upsertPassagePracticeResult,
  type PassagePracticeResult,
} from '@/data/user/passagePracticeRepository';
import { cn } from '@/utils/cn';

type PassageQuestionProps = {
  passageId: string;
  question: PassageQuestionType;
  savedResult: PassagePracticeResult | null;
  onAnswerSubmitted: (result: PassagePracticeResult) => void;
};

function formatAcceptedAnswers(acceptedAnswers: string[]): string {
  return acceptedAnswers.filter((answer) => answer.trim().length > 0).join(' / ');
}

export function PassageQuestion({
  passageId,
  question,
  savedResult,
  onAnswerSubmitted,
}: PassageQuestionProps) {
  const { userDb } = useDatabase();
  const [userAnswer, setUserAnswer] = useState(savedResult?.userAnswer ?? '');
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(
    savedResult ? (savedResult.isCorrect ? 'correct' : 'incorrect') : null,
  );

  useEffect(() => {
    setUserAnswer(savedResult?.userAnswer ?? '');
    setResult(savedResult ? (savedResult.isCorrect ? 'correct' : 'incorrect') : null);
  }, [savedResult, question.id]);

  const trimmedAnswer = userAnswer.trim();
  const canSubmit = trimmedAnswer.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    const evaluation = evaluatePassageAnswer(userAnswer, question.acceptedAnswers);
    setResult(evaluation);

    const practiceResult: PassagePracticeResult = {
      passageId,
      questionId: question.id,
      isCorrect: evaluation === 'correct',
      userAnswer: userAnswer.trim(),
      answeredAt: new Date().toISOString(),
    };

    upsertPassagePracticeResult(userDb, practiceResult);
    onAnswerSubmitted(practiceResult);
  };

  const acceptedAnswersLabel = formatAcceptedAnswers(question.acceptedAnswers);
  const feedbackMessage =
    result === 'correct'
      ? `Correct. Accepted answer: ${acceptedAnswersLabel}`
      : result === 'incorrect'
        ? `Incorrect. Accepted answer: ${acceptedAnswersLabel}`
        : null;

  return (
    <View testID={`passage-question-${question.id}`}>
      <Text
        accessibilityRole="header"
        className="text-body-lg text-primary">
        {question.prompt}
      </Text>

      <TextInput
        accessibilityLabel={`${question.prompt} Your answer.`}
        autoCapitalize="none"
        autoCorrect={false}
        editable={result === null}
        onChangeText={setUserAnswer}
        testID={`passage-question-input-${question.id}`}
        value={userAnswer}
        className="mt-3 min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-2 text-body text-primary"
      />

      {result === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit answer"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={handleSubmit}
          testID={`passage-question-submit-${question.id}`}
          className="mt-3 min-h-[44px] items-center justify-center rounded-radius-md bg-feedback-info px-space-md py-2">
          <Text className="text-body font-semibold text-on-primary">Submit</Text>
        </Pressable>
      ) : (
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={feedbackMessage ?? undefined}
          testID={`passage-question-feedback-${question.id}`}
          className={cn(
            'mt-3 rounded-radius-md px-space-md py-3',
            result === 'correct' ? 'bg-feedback-correct/15' : 'bg-feedback-incorrect/15',
          )}>
          <Text
            className={cn(
              'text-body font-semibold',
              result === 'correct' ? 'text-feedback-correct' : 'text-feedback-incorrect',
            )}>
            {result === 'correct' ? 'Correct' : 'Incorrect'}
          </Text>
          <Text className="mt-1 text-body text-primary">
            Accepted answer: {acceptedAnswersLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
