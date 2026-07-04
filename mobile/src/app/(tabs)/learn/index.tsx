import { useFocusEffect, type Href, router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { JlptLevelPicker } from '@/components/common/JlptLevelPicker';
import { PressableScale } from '@/components/common/PressableScale';
import { MaxContentWidth } from '@/constants/theme';
import type { LessonCandidate } from '@/core/lesson/lessonPlanner';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { ITEM_TYPE_LABELS, type ItemType } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useLessonPlan } from '@/data/hooks/useLessonPlan';
import { getDueSrsStates } from '@/data/user/srsStateRepository';

function summarizeMix(items: LessonCandidate[]): string {
  const counts = new Map<ItemType, number>();
  for (const item of items) {
    counts.set(item.itemType, (counts.get(item.itemType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => `${count} ${ITEM_TYPE_LABELS[type].toLowerCase()}`)
    .join(' · ');
}

export default function LearnScreen() {
  const { userDb } = useDatabase();
  const { items, level, isLoading, refetch } = useLessonPlan();
  const [dueCount, setDueCount] = useState(0);

  const refreshDueCount = useCallback(() => {
    try {
      setDueCount(getDueSrsStates(userDb).length);
    } catch {
      setDueCount(0);
    }
  }, [userDb]);

  useEffect(() => {
    refreshDueCount();
  }, [refreshDueCount]);

  const isInitialFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialFocusRef.current) {
        isInitialFocusRef.current = false;
        return;
      }
      refetch();
      refreshDueCount();
    }, [refetch, refreshDueCount]),
  );

  const hasLesson = items.length > 0;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        <Text className="text-title-lg text-primary">Learn</Text>

        {isLoading ? (
          <View className="mt-space-xl items-center">
            <ActivityIndicator accessibilityLabel="Building today's lesson" />
          </View>
        ) : (
          <View className="mt-space-md gap-space-md">
            <FadeSlideIn index={0}>
              {hasLesson ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Start today's lesson: ${items.length} new items at ${level ?? ''}`}
                  onPress={() => router.push('/lesson' as Href)}
                  testID="learn-todays-lesson"
                  className="rounded-radius-lg border-2 border-feedback-info bg-surface p-space-lg">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-overline text-feedback-info">
                      TODAY&apos;S LESSON{level ? ` · ${level}` : ''}
                    </Text>
                    <Text className="text-overline text-secondary">AUTO-BUILT</Text>
                  </View>
                  <Text className="mt-space-sm text-title text-primary">
                    {items.length} new items, picked for you
                  </Text>
                  <Text className="mt-1 text-body-sm text-secondary">
                    {summarizeMix(items)}
                  </Text>
                  <View className="mt-space-md self-start rounded-radius-full bg-feedback-info px-space-md py-space-sm">
                    <Text className="text-body font-semibold text-primary">Start now</Text>
                  </View>
                </PressableScale>
              ) : (
                <View
                  className="rounded-radius-lg border border-border bg-surface p-space-lg"
                  testID="learn-lesson-empty">
                  <Text className="text-title text-primary">All caught up 🎉</Text>
                  <Text className="mt-1 text-body-sm text-secondary">
                    No new items to start{level ? ` at ${level}` : ''} right now. Reviews
                    keep what you&apos;ve learned sharp.
                  </Text>
                </View>
              )}
            </FadeSlideIn>

            <FadeSlideIn index={1}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={
                  dueCount > 0 ? `Review ${dueCount} items due` : 'No reviews due'
                }
                disabled={dueCount === 0}
                onPress={() => router.push('/review' as Href)}
                testID="learn-review-card"
                className="flex-row items-center justify-between rounded-radius-md border border-border bg-surface p-space-md">
                <View>
                  <Text className="text-body font-semibold text-primary">Reviews</Text>
                  <Text className="mt-1 text-body-sm text-secondary">
                    {dueCount > 0 ? `${dueCount} due now` : 'All clear'}
                  </Text>
                </View>
                <Text className="text-title text-secondary">→</Text>
              </PressableScale>
            </FadeSlideIn>

            <FadeSlideIn index={2}>
              <View className="mt-space-sm">
                <Text className="text-body font-semibold text-primary">Browse the library</Text>
                <Text className="mt-1 text-body-sm text-muted">
                  Every radical, kanji, word, and grammar point by level.
                </Text>
                <JlptLevelPicker
                  selectedLevel={null}
                  onSelect={(browseLevel: JLPTLevel) =>
                    router.push(`/learn/${browseLevel}` as Href)
                  }
                  testID="learn-browse-level"
                />
              </View>
            </FadeSlideIn>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
