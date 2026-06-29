import { usePreventRemove } from '@react-navigation/core';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { DailyThresholdNotice } from '@/components/engagement';
import {
  ReviewCard,
  SessionExitSheet,
  SessionHeader,
  WanaKanaInput,
  type ReviewCardState,
  type WanaKanaInputRef,
} from '@/components/review';
import { REVIEW_CORRECT_AUTO_ADVANCE_MS } from '@/config/constants';
import {
  evaluateReviewAnswer,
  gradeForResult,
} from '@/core/answer/reviewAnswerEvaluator';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewGrade } from '@/core/srs/srs.types';
import { useReviewSession } from '@/providers/ReviewSessionProvider';
import { focusScreenReaderOn } from '@/utils/accessibilityFocus';

const PLACEHOLDER: Record<PromptType, string> = {
  reading: 'Type reading in romaji...',
  meaning: 'Type the meaning in English...',
  production: 'Type the conjugated form in romaji...',
};

function DevGradeButtons({ onGrade }: { onGrade: (g: ReviewGrade) => void }) {
  const GRADES: { grade: ReviewGrade; label: string }[] = [
    { grade: 1, label: 'Again' },
    { grade: 2, label: 'Hard' },
    { grade: 3, label: 'Good' },
    { grade: 4, label: 'Easy' },
  ];
  return (
    <View className="flex-row gap-space-sm px-space-lg pb-space-md">
      {GRADES.map(({ grade, label }) => (
        <Pressable
          key={grade}
          accessibilityRole="button"
          accessibilityLabel={label}
          className="flex-1 items-center rounded-radius-md bg-surface-elevated py-space-sm"
          onPress={() => onGrade(grade)}>
          <Text className="text-body-sm text-secondary">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReviewScreen() {
  const {
    currentItem,
    isLoading,
    isComplete,
    totalItems,
    currentIndex,
    error,
    refetch,
    gradeCurrentItem,
    recordTypoForCurrentItem,
    cognitiveLoadPercent,
    cognitiveLoadComplete,
    snapshotSessionDuration,
  } = useReviewSession();

  const [exitVisible, setExitVisible] = useState(false);
  const [thresholdNoticeVisible, setThresholdNoticeVisible] = useState(false);
  const thresholdNoticeShownRef = useRef(false);
  const navigatedToSummaryRef = useRef(false);
  const [cardState, setCardState] = useState<ReviewCardState>('prompting');
  const [answerText, setAnswerText] = useState('');
  const [displayAnswer, setDisplayAnswer] = useState<string | undefined>();
  const [hintsUsed, setHintsUsed] = useState(0);
  const inputRef = useRef<WanaKanaInputRef>(null);
  const resultRef = useRef<RNView>(null);
  const continueButtonRef = useRef<RNView>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);
  const isEndingRef = useRef(false);
  const hasActiveSession = totalItems > 0 && !isComplete && !isLoading && !error;

  const inputEditable = cardState === 'prompting' || cardState === 'typo';

  usePreventRemove(hasActiveSession && !exitVisible && !isEndingRef.current, () => {
    setExitVisible(true);
  });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!hasActiveSession) return false;
      if (exitVisible) return true;
      setExitVisible(true);
      return true;
    });
    return () => sub.remove();
  }, [hasActiveSession, exitVisible]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setCardState('prompting');
    setAnswerText('');
    setDisplayAnswer(undefined);
    setHintsUsed(0);
    isSubmittingRef.current = false;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [currentItem?.itemId]);

  useEffect(() => {
    if (cardState !== 'correct' && cardState !== 'incorrect' && cardState !== 'typo') {
      return;
    }

    let cancelled = false;
    let typoInputTimer: ReturnType<typeof setTimeout> | null = null;

    void AccessibilityInfo.isScreenReaderEnabled().then((screenReaderEnabled) => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;

        if (cardState === 'incorrect' && !screenReaderEnabled) {
          continueButtonRef.current?.focus();
          return;
        }

        void focusScreenReaderOn(resultRef.current).then(() => {
          if (cancelled) return;
          if (cardState === 'typo') {
            typoInputTimer = setTimeout(
              () => inputRef.current?.focus(),
              screenReaderEnabled ? 300 : 0,
            );
          }
        });
      });
    });

    return () => {
      cancelled = true;
      if (typoInputTimer != null) {
        clearTimeout(typoInputTimer);
      }
    };
  }, [cardState]);

  useEffect(() => {
    if (cognitiveLoadComplete && !thresholdNoticeShownRef.current) {
      thresholdNoticeShownRef.current = true;
      setThresholdNoticeVisible(true);
      AccessibilityInfo.announceForAccessibility(
        "You've done enough for today. Keep going if you like, or wrap up anytime.",
      );
    }
  }, [cognitiveLoadComplete]);

  useEffect(() => {
    if (!isComplete || navigatedToSummaryRef.current) return;
    navigatedToSummaryRef.current = true;
    router.replace('/review/summary' as Href);
  }, [isComplete]);

  const handleSubmit = useCallback(() => {
    if (!currentItem || !inputEditable) return;
    if (!answerText.trim()) return;
    // Guard against a second submit (e.g. rapid double return-key) racing the
    // state-derived `inputEditable` flag before it re-renders.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setCardState('evaluating');
    const evaluation = evaluateReviewAnswer(currentItem, answerText);

    if (currentItem.promptType !== 'meaning') {
      AccessibilityInfo.announceForAccessibility(answerText);
    }

    if (evaluation.result === 'correct') {
      setCardState('correct');
      const grade = gradeForResult(evaluation.result, { hintsUsed }) ?? 3;
      autoAdvanceTimer.current = setTimeout(() => {
        gradeCurrentItem(grade);
      }, REVIEW_CORRECT_AUTO_ADVANCE_MS);
      return;
    }

    if (evaluation.result === 'typo') {
      // Record typo non-terminally — the typo branch never calls gradeCurrentItem.
      // Rule: a typo followed by a correct retry records one typo + one correct.
      recordTypoForCurrentItem();
      setCardState('typo');
      setAnswerText('');
      // Re-prompt: allow the next attempt to submit again.
      isSubmittingRef.current = false;
      return;
    }

    const answer = evaluation.displayAnswer ?? currentItem.meanings[0] ?? '';
    setDisplayAnswer(answer);
    setCardState('incorrect');
  }, [answerText, currentItem, gradeCurrentItem, hintsUsed, inputEditable, recordTypoForCurrentItem]);

  function handleContinueIncorrect() {
    gradeCurrentItem(gradeForResult('incorrect') ?? 1);
  }

  function handleEndSession() {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    navigatedToSummaryRef.current = true;
    setExitVisible(false);
    snapshotSessionDuration();
    router.replace('/review/summary' as Href);
  }

  function handleKeepGoing() {
    setExitVisible(false);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Review Unavailable</Text>
          <Text className="text-body text-secondary">
            {error.userMessage ?? error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={refetch}>
            <Text className="text-body text-feedback-info">Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={() => router.back()}>
            <Text className="text-body text-secondary">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Nothing due — keep inline message rather than routing to an empty summary.
  if (totalItems === 0 && !isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">No Reviews Due</Text>
          <Text className="text-body text-secondary">
            No items due for review right now.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={() => router.back()}>
            <Text className="text-body text-feedback-info">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="Loading session summary" />
      </SafeAreaView>
    );
  }

  if (!currentItem) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const inputMode =
    currentItem.promptType === 'meaning' ? 'english' : 'kana';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <SessionHeader
        currentIndex={currentIndex}
        totalItems={totalItems}
        itemType={currentItem.itemType}
        cognitiveLoadPercent={cognitiveLoadPercent}
        onExitPress={() => setExitVisible(true)}
      />

      <DailyThresholdNotice
        visible={thresholdNoticeVisible}
        onDismiss={() => setThresholdNoticeVisible(false)}
      />

      <View className="flex-1 justify-center px-space-md">
        <ReviewCard
          item={currentItem}
          state={cardState}
          displayAnswer={displayAnswer}
          onHintReveal={setHintsUsed}
          resultRef={resultRef}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {cardState === 'incorrect' ? (
          <View className="px-space-md pb-space-md">
            <Button
              ref={continueButtonRef}
              label="Continue"
              onPress={handleContinueIncorrect}
              variant="primary"
            />
          </View>
        ) : (
          <View className="px-space-md pb-space-md">
            <WanaKanaInput
              ref={inputRef}
              mode={inputMode}
              value={answerText}
              onChangeText={setAnswerText}
              onSubmit={handleSubmit}
              placeholder={PLACEHOLDER[currentItem.promptType]}
              editable={inputEditable}
              autoFocus={inputEditable}
            />
          </View>
        )}
        {__DEV__ && <DevGradeButtons onGrade={gradeCurrentItem} />}
      </KeyboardAvoidingView>

      <SessionExitSheet
        visible={exitVisible}
        onKeepGoing={handleKeepGoing}
        onEndSession={handleEndSession}
      />
    </SafeAreaView>
  );
}
