import { usePreventRemove } from '@react-navigation/core';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { DailyThresholdNotice } from '@/components/engagement';
import {
  GrammarMcOptions,
  ReviewCard,
  resolveCorrectReveal,
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
import type { ReviewGrade, StageTransition } from '@/core/srs/srs.types';
import { useReviewRevealDetails } from '@/data/hooks/useReviewRevealDetails';
import { useReviewSession, type AddSynonymOutcome } from '@/providers/ReviewSessionProvider';
import { focusScreenReaderOn } from '@/utils/accessibilityFocus';
import { cn } from '@/utils/cn';
import { safeBack } from '@/utils/safeBack';

const PLACEHOLDER: Record<PromptType, string> = {
  reading: 'Type reading in romaji...',
  meaning: 'Type the meaning in English...',
  production: 'Type the conjugated form in romaji...',
};

// Grammar prompts are cloze (Plan 07) — the field wants the missing chunk.
const GRAMMAR_PLACEHOLDER = 'Type the missing piece...';

export default function ReviewScreen() {
  const {
    currentItem,
    prefetchBuffer,
    isLoading,
    isComplete,
    totalItems,
    currentIndex,
    cursor,
    error,
    refetch,
    gradeCurrentItem,
    peekStageTransition,
    recordTypoForCurrentItem,
    addSynonymForCurrentItem,
    cognitiveLoadPercent,
    cognitiveLoadComplete,
    snapshotSessionDuration,
  } = useReviewSession();
  const getRevealDetail = useReviewRevealDetails(currentItem, prefetchBuffer);

  const [exitVisible, setExitVisible] = useState(false);
  const [thresholdNoticeVisible, setThresholdNoticeVisible] = useState(false);
  const thresholdNoticeShownRef = useRef(false);
  const navigatedToSummaryRef = useRef(false);
  const [cardState, setCardState] = useState<ReviewCardState>('prompting');
  const [answerText, setAnswerText] = useState('');
  const [displayAnswer, setDisplayAnswer] = useState<string | undefined>();
  const [stageTransition, setStageTransition] = useState<StageTransition | null>(null);
  // The answer that was rejected on the incorrect reveal, offered as a one-tap synonym.
  const [rejectedAnswer, setRejectedAnswer] = useState('');
  const [synonymState, setSynonymState] = useState<AddSynonymOutcome | { status: 'idle' }>({
    status: 'idle',
  });
  // Near-miss teaching flag for the incorrect reveal (Plan 10).
  const [incompleteAnswer, setIncompleteAnswer] = useState(false);
  const inputRef = useRef<WanaKanaInputRef>(null);
  const resultRef = useRef<RNView>(null);
  const continueButtonRef = useRef<RNView>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A correct answer's grade is deferred behind the auto-advance timer for UI
  // pacing only — it must still be applied if the session ends inside that window.
  const pendingGradeRef = useRef<ReviewGrade | null>(null);
  const gradeCurrentItemRef = useRef(gradeCurrentItem);
  gradeCurrentItemRef.current = gradeCurrentItem;
  const isSubmittingRef = useRef(false);
  const isEndingRef = useRef(false);
  const hasActiveSession = totalItems > 0 && !isComplete && !isLoading && !error;

  const inputEditable =
    cardState === 'prompting' ||
    cardState === 'typo' ||
    cardState === 'wrong_script' ||
    cardState === 'wrong_reading_type';

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

  const flushPendingGrade = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (pendingGradeRef.current !== null) {
      const grade = pendingGradeRef.current;
      pendingGradeRef.current = null;
      gradeCurrentItemRef.current(grade);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Apply any grade still waiting on the auto-advance timer so a correct
      // answer isn't lost when the screen unmounts mid-window.
      flushPendingGrade();
    };
  }, [flushPendingGrade]);

  useEffect(() => {
    setCardState('prompting');
    setAnswerText('');
    setDisplayAnswer(undefined);
    setStageTransition(null);
    setRejectedAnswer('');
    setSynonymState({ status: 'idle' });
    setIncompleteAnswer(false);
    isSubmittingRef.current = false;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    pendingGradeRef.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
    // Keyed on cursor, not itemId — a retry of the same item can land back-to-back
    // on a short queue and must still reset the card.
  }, [cursor]);

  useEffect(() => {
    if (
      cardState !== 'correct' &&
      cardState !== 'incorrect' &&
      cardState !== 'typo' &&
      cardState !== 'wrong_script' &&
      cardState !== 'wrong_reading_type'
    ) {
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
          if (
            cardState === 'typo' ||
            cardState === 'wrong_script' ||
            cardState === 'wrong_reading_type'
          ) {
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

  const submitAnswer = useCallback((submittedAnswer: string, options?: { fromMc?: boolean }) => {
    if (!currentItem || !inputEditable) return;
    if (!submittedAnswer.trim()) return;
    // Guard against a second submit (e.g. rapid double return-key) racing the
    // state-derived `inputEditable` flag before it re-renders.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setCardState('evaluating');
    let evaluation = evaluateReviewAnswer(currentItem, submittedAnswer);

    // MC has no "try again" affordance: a picked option is a committed answer,
    // so the non-terminal typo/wrong_script states collapse to incorrect.
    if (
      options?.fromMc &&
      (evaluation.result === 'typo' ||
        evaluation.result === 'wrong_script' ||
        evaluation.result === 'wrong_reading_type')
    ) {
      evaluation = { result: 'incorrect' };
    }

    if (currentItem.promptType !== 'meaning') {
      AccessibilityInfo.announceForAccessibility(submittedAnswer);
    }

    if (evaluation.result === 'correct') {
      setCardState('correct');
      const grade = gradeForResult(evaluation.result) ?? 3;
      setStageTransition(peekStageTransition(grade));
      pendingGradeRef.current = grade;
      autoAdvanceTimer.current = setTimeout(() => {
        autoAdvanceTimer.current = null;
        pendingGradeRef.current = null;
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

    if (evaluation.result === 'wrong_script') {
      // Category error, not a knowledge error: nudge and re-prompt without
      // grading or recording anything — a script mixup is not a weakness signal.
      setCardState('wrong_script');
      setAnswerText('');
      isSubmittingRef.current = false;
      return;
    }

    if (evaluation.result === 'wrong_reading_type') {
      // Valid kun'yomi at the on'yomi prompt (FR82): non-terminal like
      // wrong_script — no grade, no weakness signal, nudge and re-prompt.
      setCardState('wrong_reading_type');
      setAnswerText('');
      isSubmittingRef.current = false;
      return;
    }

    const answer = evaluation.displayAnswer ?? currentItem.displayMeaning;
    setDisplayAnswer(answer);
    setRejectedAnswer(submittedAnswer.trim());
    setIncompleteAnswer(evaluation.feedbackKind === 'incomplete');
    setStageTransition(peekStageTransition(gradeForResult('incorrect') ?? 1));
    setCardState('incorrect');
  }, [currentItem, gradeCurrentItem, inputEditable, peekStageTransition, recordTypoForCurrentItem]);

  const handleSubmit = useCallback(() => {
    submitAnswer(answerText);
  }, [answerText, submitAnswer]);

  function handleContinueIncorrect() {
    gradeCurrentItem(gradeForResult('incorrect') ?? 1);
  }

  function handleAddSynonym(options?: { force?: boolean }) {
    if (!rejectedAnswer) return;
    setSynonymState(addSynonymForCurrentItem(rejectedAnswer, options));
  }

  // "Don't know" — reveal the correct answer and mark the item incorrect,
  // reusing the same incorrect flow as a wrong submission (Continue grades it).
  function handleDontKnow() {
    if (!currentItem || !inputEditable) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const { value } = resolveCorrectReveal(currentItem);
    setDisplayAnswer(value);
    setStageTransition(peekStageTransition(gradeForResult('incorrect') ?? 1));
    setCardState('incorrect');
  }

  function handleEndSession() {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    navigatedToSummaryRef.current = true;
    setExitVisible(false);
    flushPendingGrade();
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
            onPress={safeBack}>
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
            onPress={safeBack}>
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

  // Apprentice grammar answers by multiple choice (Plan 08). Options are
  // built at queue time; absence means fall back to type-in.
  const isMcCard =
    currentItem.itemType === 'grammar' &&
    currentItem.inputMode === 'mc' &&
    !!currentItem.mcOptions &&
    currentItem.mcOptions.length > 1;

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          testID="review-focal-scroll"
          className="flex-1 px-space-md"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled">
          <ReviewCard
            item={currentItem}
            state={cardState}
            displayAnswer={displayAnswer}
            stageTransition={stageTransition}
            resultRef={resultRef}
            revealDetail={getRevealDetail(currentItem.itemId)}
            incompleteAnswer={incompleteAnswer}
            rejectedAnswer={rejectedAnswer}
            synonymState={synonymState}
            onAddSynonym={handleAddSynonym}
          />
        </ScrollView>

        {cardState === 'incorrect' ? (
          <View className="px-space-md pb-space-md">
            <Button
              ref={continueButtonRef}
              label="Continue"
              onPress={handleContinueIncorrect}
              variant="primary"
            />
          </View>
        ) : isMcCard ? (
          <View
            className={cn(
              'gap-space-sm px-space-md pb-space-md',
              !inputEditable && 'opacity-50',
            )}>
            <GrammarMcOptions
              key={cursor}
              options={currentItem.mcOptions!}
              onSelect={(option) => submitAnswer(option, { fromMc: true })}
              disabled={!inputEditable}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Don't know"
              accessibilityState={{ disabled: !inputEditable }}
              className="min-h-[44px] items-center justify-center"
              disabled={!inputEditable}
              onPress={handleDontKnow}>
              <Text className="text-caption text-secondary">Don&apos;t know</Text>
            </Pressable>
          </View>
        ) : (
          // Dim (never hide) the input while feedback is showing — the input
          // must stay mounted and autofocus-ready so the review loop stays
          // keyboard-driven with zero added taps per item.
          <View
            className={cn(
              'gap-space-sm px-space-md pb-space-md',
              !inputEditable && 'opacity-50',
            )}>
            <WanaKanaInput
              ref={inputRef}
              mode={inputMode}
              value={answerText}
              onChangeText={setAnswerText}
              onSubmit={handleSubmit}
              placeholder={
                currentItem.itemType === 'grammar'
                  ? GRAMMAR_PLACEHOLDER
                  : PLACEHOLDER[currentItem.promptType]
              }
              editable={inputEditable}
              autoFocus={inputEditable}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Don't know"
              accessibilityState={{ disabled: !inputEditable }}
              className="min-h-[44px] items-center justify-center"
              disabled={!inputEditable}
              onPress={handleDontKnow}>
              <Text className="text-caption text-secondary">Don&apos;t know</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <SessionExitSheet
        visible={exitVisible}
        onKeepGoing={handleKeepGoing}
        onEndSession={handleEndSession}
      />
    </SafeAreaView>
  );
}
