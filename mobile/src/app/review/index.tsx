import { usePreventRemove } from '@react-navigation/core';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { GuidanceCardNotice } from '@/components/common/GuidanceCardNotice';
import { DailyThresholdNotice } from '@/components/engagement';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { GUIDANCE_CARD_BY_ID } from '@/components/onboarding/cardRegistry';
import {
  ReviewCard,
  resolveCorrectReveal,
  SessionExitSheet,
  SessionHeader,
  WanaKanaInput,
  type ReviewCardState,
  type WanaKanaInputRef,
  type WanaKanaInputState,
} from '@/components/review';
import { REVIEW_CORRECT_AUTO_ADVANCE_MS } from '@/config/constants';
import type { AnswerCollision } from '@/core/answer/answer.types';
import {
  evaluateReviewAnswer,
  gradeForResult,
} from '@/core/answer/reviewAnswerEvaluator';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewGrade, StageTransition } from '@/core/srs/srs.types';
import { useAnswerCollision } from '@/data/hooks/useAnswerCollision';
import { useGuidanceCard } from '@/data/hooks/useGuidanceCard';
import { useReviewAutoAdvance } from '@/data/hooks/useReviewAutoAdvance';
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

// Grammar pair (spec §3): Read asks for the grammar's meaning; Build for the
// whole sentence in Japanese.
const GRAMMAR_PLACEHOLDER: Record<PromptType, string> = {
  meaning: 'Type what the highlighted grammar means...',
  production: 'Type the sentence in Japanese...',
  reading: 'Type the sentence in Japanese...',
};

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
    addGrammarAnswerForCurrentItem,
    cognitiveLoadPercent,
    cognitiveLoadComplete,
    snapshotSessionDuration,
  } = useReviewSession();
  const getRevealDetail = useReviewRevealDetails(currentItem, prefetchBuffer);
  const { autoAdvanceEnabled } = useReviewAutoAdvance();
  const detectAnswerCollision = useAnswerCollision();

  const [exitVisible, setExitVisible] = useState(false);
  const [thresholdNoticeVisible, setThresholdNoticeVisible] = useState(false);
  const thresholdNoticeShownRef = useRef(false);
  const navigatedToSummaryRef = useRef(false);
  const [cardState, setCardState] = useState<ReviewCardState>('prompting');
  const [grammarAnswerError, setGrammarAnswerError] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [displayAnswer, setDisplayAnswer] = useState<string | undefined>();
  const [stageTransition, setStageTransition] = useState<StageTransition | null>(null);
  // The answer that was rejected on the incorrect reveal, offered as a one-tap synonym.
  const [rejectedAnswer, setRejectedAnswer] = useState('');
  const [synonymState, setSynonymState] = useState<AddSynonymOutcome | { status: 'idle' }>({
    status: 'idle',
  });
  // Near-miss teaching flag for the incorrect reveal (Plan 10).
  // The submitted answer matched a different item's accepted answer (FR86).
  const [answerCollision, setAnswerCollision] = useState<AnswerCollision | null>(null);

  // Contextual guidance (Epic 7). Both must be called unconditionally, above the
  // loading/error/empty/complete early returns below — and after `cardState`,
  // which the first one keys on. Each fires at most once per mounted session.
  const firstMissCard = useGuidanceCard('first-miss', cardState === 'incorrect');
  // Suppressed on the incorrect reveal — first-miss owns that moment, and two
  // stacked notices would duplicate testIDs.
  const spacedRepetitionCard = useGuidanceCard(
    'spaced-repetition',
    (currentItem?.srsState.reps ?? 0) >= 1 && cardState !== 'incorrect',
  );
  // Reps stay >= 1 across consecutive repeat items, so `active` never gets the
  // false edge that would hide this notice on advance. Track the item it fired
  // for and gate the render on it — the notice can never sit over the next
  // prompt — and dismiss once the session has moved on.
  const currentItemId = currentItem?.itemId ?? null;
  const { visible: srCardVisible, dismiss: srCardDismiss } = spacedRepetitionCard;
  const [srShownItemId, setSrShownItemId] = useState<string | null>(null);
  useEffect(() => {
    if (!srCardVisible) {
      setSrShownItemId(null);
      return;
    }
    if (srShownItemId !== null && srShownItemId !== currentItemId) {
      setSrShownItemId(null);
      srCardDismiss();
      return;
    }
    setSrShownItemId(currentItemId);
  }, [srCardVisible, currentItemId, srShownItemId, srCardDismiss]);

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

  const canSubmitAnswer =
    cardState === 'prompting' ||
    cardState === 'typo' ||
    cardState === 'wrong_script' ||
    cardState === 'wrong_reading_type' ||
    cardState === 'other_grammar';

  // The input stays editable (and focused — submitBehavior="submit") through the
  // correct state so the second Return can advance without re-tapping (FR84).
  const inputEditable = canSubmitAnswer || cardState === 'correct';

  usePreventRemove(hasActiveSession && !exitVisible && !isEndingRef.current, () => {
    setExitVisible(true);
  });

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

  // Nested details/compare push blurs this screen — cancel Lightning Mode so
  // the session cannot advance under the overlay. Pending grade stays for
  // Return/Continue (or flush on exit/unmount).
  //
  // Hardware back is registered only while focused: a global listener would
  // steal back from `/review/item` / `/review/compare` and open "End session?"
  // instead of popping the nested screen (the Modal renders above everything).
  useFocusEffect(
    useCallback(() => {
      const backSub = hasActiveSession
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            if (exitVisible) return true;
            setExitVisible(true);
            return true;
          })
        : null;

      return () => {
        backSub?.remove();
        if (autoAdvanceTimer.current) {
          clearTimeout(autoAdvanceTimer.current);
          autoAdvanceTimer.current = null;
        }
      };
    }, [hasActiveSession, exitVisible]),
  );

  useEffect(() => {
    setCardState('prompting');
    setAnswerText('');
    setDisplayAnswer(undefined);
    setStageTransition(null);
    setRejectedAnswer('');
    setSynonymState({ status: 'idle' });
    setGrammarAnswerError(false);
    setAnswerCollision(null);
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
      cardState !== 'wrong_reading_type' &&
      cardState !== 'other_grammar'
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
            cardState === 'wrong_reading_type' ||
            cardState === 'other_grammar'
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

  const submitAnswer = useCallback((submittedAnswer: string) => {
    if (!currentItem || !canSubmitAnswer) return;
    if (!submittedAnswer.trim()) return;
    // Guard against a second submit (e.g. rapid double return-key) racing the
    // state-derived `inputEditable` flag before it re-renders.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setCardState('evaluating');
    const evaluation = evaluateReviewAnswer(currentItem, submittedAnswer);

    if (currentItem.promptType !== 'meaning') {
      AccessibilityInfo.announceForAccessibility(submittedAnswer);
    }

    if (evaluation.result === 'correct') {
      Keyboard.dismiss();
      setCardState('correct');
      const grade = gradeForResult(evaluation.result) ?? 3;
      setStageTransition(peekStageTransition(grade));
      // Default (FR84): hold the grade until the next Return/Continue. The
      // 800ms timer only runs when Lightning Mode is enabled in Settings.
      pendingGradeRef.current = grade;
      if (autoAdvanceEnabled) {
        autoAdvanceTimer.current = setTimeout(() => {
          autoAdvanceTimer.current = null;
          pendingGradeRef.current = null;
          gradeCurrentItem(grade);
        }, REVIEW_CORRECT_AUTO_ADVANCE_MS);
      }
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

    if (evaluation.result === 'other_grammar') {
      // Same meaning with a same-family grammar point (D6): nudge, no grade.
      // The typed sentence stays so only the grammar needs changing.
      setCardState('other_grammar');
      isSubmittingRef.current = false;
      return;
    }

    const answer = evaluation.displayAnswer ?? currentItem.displayMeaning;
    setDisplayAnswer(answer);
    setRejectedAnswer(submittedAnswer.trim());
    // Sync curriculum lookup — never blocks the <100ms feedback path (NFR1).
    // Guard throws so a DB/lookup failure cannot leave the card stuck evaluating.
    let collision: AnswerCollision | null = null;
    try {
      collision = detectAnswerCollision(currentItem, submittedAnswer);
    } catch {
      collision = null;
    }
    setAnswerCollision(collision);
    setStageTransition(peekStageTransition(gradeForResult('incorrect') ?? 1));
    Keyboard.dismiss();
    setCardState('incorrect');
  }, [autoAdvanceEnabled, canSubmitAnswer, currentItem, detectAnswerCollision, gradeCurrentItem, peekStageTransition, recordTypoForCurrentItem]);

  // Second Return (or Continue) after a correct answer: apply the deferred
  // grade and advance. Never re-evaluates input — the answer already graded.
  const advanceFromCorrect = useCallback(() => {
    if (cardState !== 'correct') return;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    const grade = pendingGradeRef.current;
    if (grade !== null) {
      pendingGradeRef.current = null;
      gradeCurrentItem(grade);
    }
  }, [cardState, gradeCurrentItem]);

  const handleSubmit = useCallback(() => {
    if (cardState === 'correct') {
      advanceFromCorrect();
      return;
    }
    submitAnswer(answerText);
  }, [advanceFromCorrect, answerText, cardState, submitAnswer]);

  function handleContinueIncorrect() {
    // isSubmittingRef stays true after an incorrect reveal until the cursor
    // advances — reuse it so a double-tap Continue cannot grade twice.
    if (cardState !== 'incorrect' || !isSubmittingRef.current) return;
    isSubmittingRef.current = false;
    gradeCurrentItem(gradeForResult('incorrect') ?? 1);
  }

  function handleAddSynonym(options?: { force?: boolean }) {
    if (!rejectedAnswer) return;
    setSynonymState(addSynonymForCurrentItem(rejectedAnswer, options));
  }

  // "My answer is correct too" (D4): save the rejected sentence, then regrade
  // this card Good. The incorrect grade has not been written yet — Continue
  // writes it — so the regrade simply replaces it.
  function handleSaveGrammarAnswer() {
    if (cardState !== 'incorrect' || !rejectedAnswer) return;
    if (addGrammarAnswerForCurrentItem(rejectedAnswer).status !== 'added') {
      setGrammarAnswerError(true);
      return;
    }
    const grade = gradeForResult('correct') ?? 3;
    setStageTransition(peekStageTransition(grade));
    pendingGradeRef.current = grade;
    isSubmittingRef.current = false;
    setCardState('correct');
  }

  // "Don't know" — reveal the correct answer and mark the item incorrect,
  // reusing the same incorrect flow as a wrong submission (Continue grades it).
  function handleDontKnow() {
    if (!currentItem || !canSubmitAnswer) return;
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const { value } = resolveCorrectReveal(currentItem);
    setDisplayAnswer(value);
    setStageTransition(peekStageTransition(gradeForResult('incorrect') ?? 1));
    Keyboard.dismiss();
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
          <Text className="text-title font-ui-extrabold text-primary">Review Unavailable</Text>
          <Text className="text-body font-ui text-secondary">
            {error.userMessage ?? error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] justify-center self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={refetch}>
            <Text className="text-body font-ui-semibold text-brand-text">Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] justify-center self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={safeBack}>
            <Text className="text-body font-ui text-secondary">Back</Text>
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
          <Text className="text-title font-ui-extrabold text-primary">No Reviews Due</Text>
          <Text className="text-body font-ui text-secondary">
            No items due for review right now.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] justify-center self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={safeBack}>
            <Text className="text-body font-ui-semibold text-brand-text">Back</Text>
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

  // The field wears the verdict (Session 2's five states). The explanation line
  // stays in the card, which is what the screen reader is focused on — the
  // field would only repeat it.
  const inputState: WanaKanaInputState =
    cardState === 'correct'
      ? 'correct'
      : cardState === 'typo'
        ? 'near-miss'
        : cardState === 'wrong_script' ||
            cardState === 'wrong_reading_type' ||
            cardState === 'other_grammar'
          ? 'wrong-script'
          : 'idle';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <SessionHeader
        cardsCompleted={currentIndex}
        totalCards={totalItems}
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
          <ItemLinkProvider base="/review/item">
            <ReviewCard
              item={currentItem}
              state={cardState}
              displayAnswer={displayAnswer}
              stageTransition={stageTransition}
              resultRef={resultRef}
              revealDetail={getRevealDetail(currentItem.itemId)}
                rejectedAnswer={rejectedAnswer}
              synonymState={synonymState}
              onAddSynonym={handleAddSynonym}
              answerCollision={answerCollision}
              onSaveGrammarAnswer={handleSaveGrammarAnswer}
              grammarAnswerError={grammarAnswerError}
            />
          </ItemLinkProvider>

          {firstMissCard.visible ? (
            <GuidanceCardNotice
              card={GUIDANCE_CARD_BY_ID['first-miss']}
              onDismiss={firstMissCard.dismiss}
            />
          ) : null}

          {srCardVisible && srShownItemId === currentItemId ? (
            <GuidanceCardNotice
              card={GUIDANCE_CARD_BY_ID['spaced-repetition']}
              subject={currentItem.primaryForm}
              onDismiss={srCardDismiss}
            />
          ) : null}
        </ScrollView>

        {cardState === 'incorrect' ? (
          <View className="gap-space-sm px-space-md pb-space-md">
            {/* The rejected answer, kept on screen in the danger chrome — the
                reveal offers to accept it as a synonym, so it has to be
                readable. "Don't know" submits nothing, so there is nothing to
                show for it. */}
            {rejectedAnswer ? (
              <WanaKanaInput
                mode={inputMode}
                value={rejectedAnswer}
                onChangeText={() => {}}
                onSubmit={() => {}}
                editable={false}
                autoFocus={false}
                state="incorrect"
                testID="review-rejected-answer"
              />
            ) : null}
            <Button
              ref={continueButtonRef}
              label="Continue"
              onPress={handleContinueIncorrect}
              variant="primary"
            />
          </View>
        ) : cardState === 'correct' ? (
          // Visible Continue on correct (touch / soft-keyboard).
          // Typed path also keeps the input mounted so second Return still
          // advances (FR84). Continue doubles as early advance while Lightning
          // Mode's timer is pending.
          <View className="gap-space-sm px-space-md pb-space-md">
            <WanaKanaInput
              ref={inputRef}
              mode={inputMode}
              value={answerText}
              onChangeText={setAnswerText}
              onSubmit={handleSubmit}
              placeholder={
                currentItem.itemType === 'grammar'
                  ? GRAMMAR_PLACEHOLDER[currentItem.promptType]
                  : PLACEHOLDER[currentItem.promptType]
              }
              editable={inputEditable}
              autoFocus={inputEditable}
              state={inputState}
            />
            <Button
              ref={continueButtonRef}
              label="Continue"
              onPress={advanceFromCorrect}
              variant="primary"
            />
          </View>
        ) : (
          // Dim (never hide) the input while feedback is showing — the input
          // must stay mounted and autofocus-ready so the review loop stays
          // keyboard-driven with zero added taps per item.
          <View
            className={cn(
              'gap-space-sm px-space-md pb-space-md',
              !canSubmitAnswer && 'opacity-50',
            )}>
            <WanaKanaInput
              ref={inputRef}
              mode={inputMode}
              value={answerText}
              onChangeText={setAnswerText}
              onSubmit={handleSubmit}
              placeholder={
                currentItem.itemType === 'grammar'
                  ? GRAMMAR_PLACEHOLDER[currentItem.promptType]
                  : PLACEHOLDER[currentItem.promptType]
              }
              editable={inputEditable}
              autoFocus={inputEditable}
              state={inputState}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Don't know"
              accessibilityState={{ disabled: !canSubmitAnswer }}
              className="min-h-[44px] items-center justify-center"
              disabled={!canSubmitAnswer}
              onPress={handleDontKnow}>
              <Text className="text-label font-ui-semibold text-muted">Don&apos;t know</Text>
            </Pressable>
            {/* Return still submits (FR84) — this is the touch path to the same
                call, for anyone answering without a hardware keyboard. */}
            <Button
              label="Submit"
              onPress={handleSubmit}
              disabled={!canSubmitAnswer || !answerText.trim()}
              testID="review-submit"
            />
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
