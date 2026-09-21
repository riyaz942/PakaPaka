import { router, type Href } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimationCallback,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { LessonSessionHeader } from '@/components/common/LessonSessionHeader';
import { ItemLinkProvider } from '@/components/learn/ItemLinkContext';
import { LESSON_SECTION_COUNT } from '@/components/lesson/LessonItemSections';
import { LessonItemView } from '@/components/lesson/LessonItemView';
import { MaxContentWidth } from '@/constants/theme';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLessonPlan } from '@/data/hooks/useLessonPlan';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import { addDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { resolveDailyGoalTarget } from '@/data/user/goalRingRepository';
import { startLessonItems } from '@/data/user/lessonProgressRepository';
import { recordReviewAndUpdateStreak } from '@/data/user/streakRepository';
import { safeBack } from '@/utils/safeBack';

/** Drag past this, or flick faster than this, and the card commits. */
const SWIPE_DISTANCE_PX = 90;
const SWIPE_VELOCITY = 550;
/** Horizontal intent before the card takes over from the vertical scroll. */
const HORIZONTAL_ACTIVATION_PX = 14;
const VERTICAL_BAILOUT_PX = 14;
const EXIT_MS = 170;
const ENTER_MS = 220;
/** Degrees of tilt at full-width drag — a hint of weight, not a spin. */
const MAX_TILT_DEG = 7;

type SwipeDirection = 'next' | 'back';

/**
 * Auto-generated lesson session: walks the planned items one at a time.
 * Nothing is committed until the final item — leaving mid-lesson costs nothing.
 */
export default function LessonScreen() {
  const { userDb } = useDatabase();
  const [learnAnyway, setLearnAnyway] = useState(false);
  const { items, level, isLoading, capReached } = useLessonPlan({
    ignoreAllowance: learnAnyway,
  });
  const [index, setIndex] = useState(0);
  // Inner section index, local to the current item and reset whenever the item
  // changes. The progress bar stays item-based — sections are pacing, not
  // progress the learner is measured against.
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = items[index] ?? null;
  const isLast = index === items.length - 1;
  const isFirst = index === 0;
  const isLastSection = sectionIndex === LESSON_SECTION_COUNT - 1;
  /** Very first card of the lesson — there is nothing behind it. */
  const isAtStart = isFirst && sectionIndex === 0;
  /** Finish-lesson advances navigate away — there is no card to slide back in. */
  const nextHasEnterAnimation = !(isLastSection && isLast);

  const { width: windowWidth } = useWindowDimensions();
  /** Far enough that the card is fully clear of the screen before the swap. */
  const exitDistance = windowWidth;
  const translateX = useSharedValue(0);
  /** Guards the exit leg so a double-tap can't stack two transitions. */
  const isSwiping = useRef(false);
  /**
   * Direction waiting for the swapped card to finish loading before the enter
   * leg runs. Starting enter in the same tick as setState raced the re-render
   * and briefly slid the *previous* card back on screen.
   */
  const pendingEnterDirection = useRef<SwipeDirection | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { reducedMotion } = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  // Nothing is committed until the final card, so stepping backwards to
  // re-read an earlier item — or an earlier section — is free.
  const handleBack = () => {
    if (sectionIndex > 0) {
      setSectionIndex((value) => value - 1);
      return;
    }
    if (!isFirst) {
      setIndex((value) => value - 1);
      // Back is the exact inverse of Continue, so leaving an item backwards
      // lands on the previous item's last section — not its introduction.
      setSectionIndex(LESSON_SECTION_COUNT - 1);
    }
  };

  const handleNext = () => {
    // Continue walks the three sections of the current item before the outer
    // control advances to the next item (FR71).
    if (!isLastSection) {
      setSectionIndex((value) => value + 1);
      return;
    }

    if (!isLast) {
      setIndex((value) => value + 1);
      setSectionIndex(0);
      return;
    }

    const result = startLessonItems(
      userDb,
      items.map((item) => item.id),
    );
    if (!result.ok) {
      setSaveError(result.error.userMessage ?? result.error.message);
      return;
    }

    // Finishing a lesson is study — it earns the same daily streak credit as a
    // review. Best-effort: a streak write failure must not block completion.
    const streakResult = recordReviewAndUpdateStreak(userDb, todayKey());
    if (!streakResult.ok && __DEV__) {
      console.warn('[Lesson] streak update failed', streakResult.error);
    }

    // Lessons fill the goal ring too (FR55): each learned item counts as one
    // toward the daily goal. One batched write for the whole lesson —
    // best-effort, never blocks completion.
    if (items.length > 0) {
      const loadResult = addDailyLoad(userDb, {
        date: todayKey(),
        increment: items.length,
        threshold: resolveDailyGoalTarget(userDb),
      });
      if (!loadResult.ok && __DEV__) {
        console.warn('[Lesson] cognitive load persist failed', loadResult.error);
      }
    }

    const itemIds = items.map((item) => item.id).join(',');
    router.replace(
      `/lesson/complete?count=${items.length}&itemIds=${encodeURIComponent(itemIds)}` as Href,
    );
  };

  // Gesture callbacks are captured when the detector attaches and are not
  // refreshed on re-render, so everything they need is read through a ref —
  // otherwise they would keep replaying the first card's state.
  const cardRef = useRef({
    handleBack,
    handleNext,
    canGoBack: !isAtStart,
    nextHasEnterAnimation,
  });
  cardRef.current = {
    handleBack,
    handleNext,
    canGoBack: !isAtStart,
    nextHasEnterAnimation,
  };

  /** Release below threshold, or nothing to go back to: card returns home. */
  const cancelSwipe = useCallback(() => {
    pendingEnterDirection.current = null;
    translateX.value = withTiming(0, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [translateX]);

  /** The one place the lesson actually moves. */
  const applyDirection = useCallback((direction: SwipeDirection) => {
    if (direction === 'next') {
      cardRef.current.handleNext();
    } else {
      cardRef.current.handleBack();
    }
  }, []);

  /** Slide the parked (already-swapped) card back onto the screen. */
  const startEnterAnimation = useCallback(
    (direction: SwipeDirection) => {
      translateX.value = direction === 'next' ? exitDistance : -exitDistance;
      translateX.value = withTiming(0, {
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
      });
    },
    [exitDistance, translateX],
  );

  /**
   * LessonItemView calls this once the new card is paint-ready. Until then the
   * card stays parked off-screen so a slow grammar load never reveals the
   * previous item mid-enter.
   */
  const onCardContentReady = useCallback(() => {
    const direction = pendingEnterDirection.current;
    if (!direction) return;
    pendingEnterDirection.current = null;
    isSwiping.current = false;
    // Reset while still off-screen so a tall previous card doesn't leave the
    // incoming one scrolled halfway down.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    startEnterAnimation(direction);
  }, [startEnterAnimation]);

  // The card has flown off. Park it on the opposite edge, swap content, and
  // wait for onCardContentReady before the enter leg — setState alone does not
  // paint in the same tick as the reposition. An unfinished exit means the
  // learner grabbed the card mid-flight: release the guard, advance nothing.
  const onExitComplete = useCallback(
    (direction: SwipeDirection, finished: boolean) => {
      if (!finished) {
        isSwiping.current = false;
        return;
      }

      const shouldEnter =
        direction === 'back'
          ? cardRef.current.canGoBack
          : cardRef.current.nextHasEnterAnimation;

      if (shouldEnter) {
        pendingEnterDirection.current = direction;
        // Hold off-screen while React commits + loads the next card. Keep the
        // swipe guard until onCardContentReady so a slow load can't be
        // interrupted mid-park.
        translateX.value = direction === 'next' ? exitDistance : -exitDistance;
      } else {
        isSwiping.current = false;
      }

      applyDirection(direction);
    },
    [applyDirection, exitDistance, translateX],
  );

  /** Fly the card off in `direction`, then swap and slide the next one in. */
  const runSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (isSwiping.current) return;
      if (direction === 'back' && !cardRef.current.canGoBack) {
        cancelSwipe();
        return;
      }

      // Reduced motion keeps the navigation, drops the travel.
      if (reducedMotionRef.current) {
        pendingEnterDirection.current = null;
        translateX.value = 0;
        applyDirection(direction);
        return;
      }

      isSwiping.current = true;
      const onExit: AnimationCallback = (finished) => {
        'worklet';
        runOnJS(onExitComplete)(direction, finished === true);
      };
      translateX.value = withTiming(
        direction === 'next' ? -exitDistance : exitDistance,
        { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
        onExit,
      );
    },
    [applyDirection, cancelSwipe, exitDistance, onExitComplete, translateX],
  );

  // Pan, so the card tracks the finger. `activeOffsetX`/`failOffsetY` hand
  // vertical drags to the ScrollView untouched — the card only takes over once
  // the movement is clearly horizontal. Buttons stay the a11y path; a gesture
  // is never the only way to advance.
  const cardGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-HORIZONTAL_ACTIVATION_PX, HORIZONTAL_ACTIVATION_PX])
        .failOffsetY([-VERTICAL_BAILOUT_PX, VERTICAL_BAILOUT_PX])
        .withTestId('lesson-card-pan')
        .onUpdate((event) => {
          translateX.value = event.translationX;
        })
        .onEnd((event) => {
          const committed =
            Math.abs(event.translationX) > SWIPE_DISTANCE_PX ||
            Math.abs(event.velocityX) > SWIPE_VELOCITY;
          if (!committed) {
            runOnJS(cancelSwipe)();
            return;
          }
          runOnJS(runSwipe)(event.translationX < 0 ? 'next' : 'back');
        }),
    [cancelSwipe, runSwipe, translateX],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotateZ: `${(translateX.value / exitDistance) * MAX_TILT_DEG}deg` },
    ],
  }));

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="Building your lesson" />
      </SafeAreaView>
    );
  }

  if (items.length === 0 && capReached) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title-lg font-ui-extrabold text-primary">
            You&apos;ve learned enough today
          </Text>
          <Text className="text-body text-secondary">
            You&apos;ve hit today&apos;s lesson limit. Come back tomorrow, or clear some
            reviews first — new items land gentler on a clear queue.
          </Text>
          <Button
            label="Learn anyway"
            variant="secondary"
            onPress={() => setLearnAnyway(true)}
            testID="lesson-learn-anyway"
          />
          <Button label="Back" variant="ghost" onPress={safeBack} />
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title-lg font-ui-extrabold text-primary">Nothing new today</Text>
          <Text className="text-body text-secondary">
            You&apos;ve started everything available{level ? ` at ${level}` : ''}. Clear
            some reviews and new items will unlock.
          </Text>
          <Button label="Back" variant="secondary" onPress={safeBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View
        className="w-full flex-1 self-center"
        style={{ maxWidth: MaxContentWidth }}>
        <LessonSessionHeader
          current={index + 1}
          total={items.length}
          itemType={current?.itemType}
          onExitPress={safeBack}
          exitAccessibilityLabel="Close lesson"
          testID="lesson-session-header"
        />

        <View className="flex-1 px-space-md">
          {current ? (
            <GestureDetector gesture={cardGesture}>
              {/* The card itself: one stable view that carries the drag, so the
                  content inside can swap without interrupting the motion. */}
              <Animated.View className="flex-1" style={cardStyle}>
                <ScrollView
                  ref={scrollRef}
                  className="mt-space-sm flex-1"
                  contentContainerClassName="pb-space-lg">
                  <ItemLinkProvider base="/lesson/item">
                    <LessonItemView
                      key={current.id}
                      itemId={current.id}
                      sectionIndex={sectionIndex}
                      onContentReady={onCardContentReady}
                    />
                  </ItemLinkProvider>
                </ScrollView>
              </Animated.View>
            </GestureDetector>
          ) : null}

          {saveError ? (
            <Text className="mb-space-sm text-body-sm font-ui-semibold text-feedback-incorrect-deep">
              {saveError}
            </Text>
          ) : null}

          <View className="flex-row gap-space-sm pb-space-md pt-space-sm">
            {/* Buttons route through the same transition as the swipe, so both
                paths look and behave identically. Back is the spec's fixed 96px
                tile; Continue takes the rest of the row. */}
            <Button
              label="Back"
              variant="tertiary"
              onPress={() => runSwipe('back')}
              disabled={isAtStart}
              accessibilityLabel={
                sectionIndex > 0 ? 'Back to previous section' : 'Back to previous item'
              }
              testID="lesson-back"
              className="w-[96px] px-space-sm"
            />
            <Button
              label={
                !isLastSection ? 'Continue' : isLast ? 'Finish lesson' : 'Got it — next'
              }
              onPress={() => runSwipe('next')}
              testID="lesson-next"
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
