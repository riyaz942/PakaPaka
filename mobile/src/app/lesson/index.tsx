import { router, type Href } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { LESSON_SECTION_COUNT } from '@/components/lesson/LessonItemSections';
import { LessonItemView } from '@/components/lesson/LessonItemView';
import { MaxContentWidth } from '@/constants/theme';
import { computeLoadIncrement } from '@/core/cognitive-load/loadTracker';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLessonPlan } from '@/data/hooks/useLessonPlan';
import { addDailyLoad, todayKey } from '@/data/user/cognitiveLoadRepository';
import { resolveDailyGoalTarget } from '@/data/user/goalRingRepository';
import { startLessonItems } from '@/data/user/lessonProgressRepository';
import { recordReviewAndUpdateStreak } from '@/data/user/streakRepository';
import { safeBack } from '@/utils/safeBack';

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

  // Nothing is committed until the final card, so stepping backwards to
  // re-read an earlier item — or an earlier section — is free.
  const handleBack = () => {
    if (sectionIndex > 0) {
      setSectionIndex((value) => value - 1);
      return;
    }
    if (!isFirst) {
      setIndex((value) => value - 1);
      // Re-entering an item starts at its introduction.
      setSectionIndex(0);
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

    // Lessons fill the goal ring too (FR55): new items enter at apprentice and
    // the lesson UI has no incorrect outcome. One batched write for the whole
    // lesson — best-effort, never blocks completion.
    const loadIncrement = items.reduce(
      (sum, lessonItem) =>
        sum +
        computeLoadIncrement({
          itemType: lessonItem.itemType,
          stageLabel: 'apprentice',
          outcome: 'correct',
        }),
      0,
    );
    if (loadIncrement > 0) {
      const loadResult = addDailyLoad(userDb, {
        date: todayKey(),
        increment: loadIncrement,
        threshold: resolveDailyGoalTarget(userDb),
      });
      if (!loadResult.ok && __DEV__) {
        console.warn('[Lesson] cognitive load persist failed', loadResult.error);
      }
    }

    router.replace(`/lesson/complete?count=${items.length}` as Href);
  };

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
          <Text className="text-title text-primary">
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
          <Button label="Back" variant="secondary" onPress={safeBack} />
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Nothing new today</Text>
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
        className="w-full flex-1 self-center px-space-lg pt-space-md"
        style={{ maxWidth: MaxContentWidth }}>
        <View className="flex-row items-center gap-space-md">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close lesson"
            onPress={safeBack}
            testID="lesson-close"
            className="min-h-[44px] min-w-[44px] items-start justify-center">
            <Text className="text-title text-secondary">✕</Text>
          </Pressable>

          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Item ${index + 1} of ${items.length}`}
            className="h-2 flex-1 overflow-hidden rounded-radius-full bg-border">
            <View
              className="h-full rounded-radius-full bg-feedback-info"
              style={{ width: `${((index + 1) / items.length) * 100}%` }}
            />
          </View>

          <Text className="text-body-sm text-secondary" testID="lesson-progress-label">
            {index + 1}/{items.length}
          </Text>
        </View>

        {current ? (
          <FadeSlideIn key={`${current.id}-${sectionIndex}`} className="flex-1">
            <ScrollView
              className="mt-space-md flex-1"
              contentContainerClassName="pb-space-lg">
              <LessonItemView itemId={current.id} sectionIndex={sectionIndex} />
            </ScrollView>
          </FadeSlideIn>
        ) : null}

        {saveError ? (
          <Text className="mb-space-sm text-body-sm text-feedback-incorrect">
            {saveError}
          </Text>
        ) : null}

        <View className="flex-row gap-space-sm pb-space-md">
          <Button
            label="Back"
            variant="secondary"
            onPress={handleBack}
            disabled={isFirst && sectionIndex === 0}
            accessibilityLabel={
              sectionIndex > 0 ? 'Back to previous section' : 'Back to previous item'
            }
            testID="lesson-back"
            className="flex-1"
          />
          <Button
            label={
              !isLastSection ? 'Continue' : isLast ? 'Finish lesson' : 'Got it — next'
            }
            onPress={handleNext}
            testID="lesson-next"
            className="flex-[2]"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
