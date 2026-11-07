import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { FuriganaText } from '@/components/common/FuriganaText';
import { Icon } from '@/components/common/Icon';
import { getSemanticColors } from '@/constants/semantic-colors';
import { evaluatePassageAnswer } from '@/core/answer/evaluatePassageAnswer';
import type { PassageQuestion as PassageQuestionType } from '@/data/curriculum/passageRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useHaptics } from '@/data/hooks/useHaptics';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';
import { useFeedbackMotion } from '@/hooks/useFeedbackMotion';
import {
  upsertPassagePracticeResult,
  type PassagePracticeResult,
} from '@/data/user/passagePracticeRepository';
import { cn } from '@/utils/cn';

type PassageQuestionProps = {
  passageId: string;
  question: PassageQuestionType;
  /** 1-based position, for the card's "COMPREHENSION · 1 OF 2" kicker. */
  position: number;
  total: number;
  savedResult: PassagePracticeResult | null;
  onAnswerSubmitted: (result: PassagePracticeResult) => void;
};

function formatAcceptedAnswers(acceptedAnswers: string[]): string {
  return acceptedAnswers.filter((answer) => answer.trim().length > 0).join(' / ');
}

export function PassageQuestion({
  passageId,
  question,
  position,
  total,
  savedResult,
  onAnswerSubmitted,
}: PassageQuestionProps) {
  const { userDb } = useDatabase();
  const { mode: furiganaMode, knownKanji } = useFuriganaPreference();
  const colors = getSemanticColors(usePaintedColorScheme());
  const { play: playHaptic } = useHaptics();
  const [userAnswer, setUserAnswer] = useState(savedResult?.userAnswer ?? '');
  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(
    savedResult ? (savedResult.isCorrect ? 'correct' : 'incorrect') : null,
  );
  // Counts submits so a second wrong try plays the motion again. A saved
  // result shown on open stays still (0 = nothing submitted here).
  const [attempt, setAttempt] = useState(0);
  const motionStyle = useFeedbackMotion(
    result === 'correct' ? 'pop' : result === 'incorrect' ? 'thud' : null,
    attempt,
  );

  useEffect(() => {
    setUserAnswer(savedResult?.userAnswer ?? '');
    setResult(savedResult ? (savedResult.isCorrect ? 'correct' : 'incorrect') : null);
    setAttempt(0);
  }, [savedResult, question.id]);

  const trimmedAnswer = userAnswer.trim();
  const isCorrect = result === 'correct';
  // BUG5: only a correct answer closes the question. An incorrect one stays
  // editable so the learner can retry; the upsert overwrites on the
  // (passage_id, question_id) primary key either way.
  const canSubmit = trimmedAnswer.length > 0 && !isCorrect;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    const evaluation = evaluatePassageAnswer(userAnswer, question.acceptedAnswers);
    setResult(evaluation);
    setAttempt((value) => value + 1);
    playHaptic(evaluation === 'correct' ? 'light' : 'error');

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
  // Reveal accepted answers only after a correct submit so "Try again" is not
  // just copy-paste from the feedback line.
  const feedbackMessage =
    result === 'correct'
      ? `Correct. Accepted answer: ${acceptedAnswersLabel}`
      : result === 'incorrect'
        ? 'Incorrect'
        : null;

  // Field chrome follows the kit's answer-input states: jade while focused,
  // then the feedback hue once the answer has been graded.
  const fieldStateClass =
    result === 'correct'
      ? 'border-feedback-correct bg-feedback-correct-soft'
      : result === 'incorrect'
        ? 'border-feedback-incorrect bg-feedback-incorrect-soft'
        : focused
          ? 'border-brand-500 bg-surface-elevated'
          : 'border-border bg-surface-elevated';

  return (
    <View
      testID={`passage-question-${question.id}`}
      className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <Text className="text-overline font-ui-bold uppercase tracking-[0.12em] text-faint">
        {`Comprehension · ${position} of ${total}`}
      </Text>

      <FuriganaText
        text={question.promptFurigana ?? question.prompt}
        mode={furiganaMode}
        knownKanji={knownKanji}
        accessibilityRole="header"
        className="font-jp-medium text-primary"
        style={{ fontSize: 17, lineHeight: 30 }}
      />

      <Animated.View style={motionStyle}>
        <TextInput
          accessibilityLabel={`${question.prompt} Your answer.`}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isCorrect}
          onChangeText={setUserAnswer}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Your answer"
          placeholderTextColor={colors.faint}
          testID={`passage-question-input-${question.id}`}
          value={userAnswer}
          className={cn(
            'mt-space-sm min-h-[48px] rounded-radius-md border-[1.5px] px-space-md py-space-sm text-body font-jp-medium text-primary',
            fieldStateClass,
          )}
        />
      </Animated.View>

      {isCorrect ? null : (
        <Button
          label={result === 'incorrect' ? 'Try again' : 'Submit'}
          accessibilityLabel={result === 'incorrect' ? 'Try again' : 'Submit answer'}
          disabled={!canSubmit}
          onPress={handleSubmit}
          testID={`passage-question-submit-${question.id}`}
          className="mt-space-sm"
        />
      )}

      {result === null ? null : (
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={feedbackMessage ?? undefined}
          testID={`passage-question-feedback-${question.id}`}
          className={cn(
            'mt-space-sm flex-row items-start gap-space-sm rounded-radius-md px-space-md py-space-sm',
            result === 'correct' ? 'bg-feedback-correct-soft' : 'bg-feedback-incorrect-soft',
          )}>
          <Icon
            name={result === 'correct' ? 'correct' : 'close'}
            size={16}
            strokeWidth={2.4}
            className={
              result === 'correct' ? 'text-feedback-correct-deep' : 'text-feedback-incorrect-deep'
            }
          />
          <View className="flex-1">
            <Text
              className={cn(
                'text-body-sm font-ui-bold',
                result === 'correct'
                  ? 'text-feedback-correct-deep'
                  : 'text-feedback-incorrect-deep',
              )}>
              {result === 'correct' ? 'Correct' : 'Incorrect'}
            </Text>
            {result === 'correct' ? (
              <Text className="mt-space-xs text-body-sm font-ui-medium text-feedback-correct-deep">
                Accepted answer: {acceptedAnswersLabel}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}
